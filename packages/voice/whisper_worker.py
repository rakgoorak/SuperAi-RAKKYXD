"""Local multilingual dictation. Audio stays on this computer."""
import argparse
import json
import sys

def arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', choices=['tiny', 'base', 'small', 'medium'], default='base')
    parser.add_argument('--language', choices=['th', 'en', 'auto'], default='th')
    parser.add_argument('--prepare', action='store_true')
    parser.add_argument('--daemon', action='store_true')
    parser.add_argument('--audio')
    parser.add_argument('--cache', required=True)
    return parser.parse_args()

def main():
    args = arguments()
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stdin, 'reconfigure'):
        sys.stdin.reconfigure(encoding='utf-8')

    from faster_whisper import WhisperModel
    model = WhisperModel(args.model, device='cpu', compute_type='int8', download_root=args.cache, local_files_only=not args.prepare)
    if args.prepare:
        print(json.dumps({'ready': True, 'model': args.model}), flush=True)
        return

    if args.daemon:
        print(json.dumps({'ready': True, 'model': args.model}), flush=True)
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                req = json.loads(line)
                action = req.get('action')
                if action == 'ping':
                    print(json.dumps({'ready': True}), flush=True)
                elif action == 'transcribe':
                    audio_path = req['audio']
                    lang = req.get('language', 'th')
                    prompt = req.get('prompt') or 'คำสั่งเขียนโค้ดภาษาไทยและอังกฤษ: React, Next.js, TypeScript, JavaScript, Python, npm, git, Docker, API, UI, HTML, CSS, component, function, test, build, dev'
                    segments, info = model.transcribe(
                        audio_path,
                        language=None if lang == 'auto' else lang,
                        initial_prompt=prompt,
                        vad_filter=True,
                        beam_size=5,
                        condition_on_previous_text=False
                    )
                    text = ''.join(segment.text for segment in segments).strip()
                    print(json.dumps({'text': text, 'language': info.language}, ensure_ascii=False), flush=True)
                elif action == 'exit':
                    break
            except Exception as e:
                print(json.dumps({'error': str(e)}, ensure_ascii=False), flush=True)
        return

    if not args.audio:
        raise ValueError('Missing audio file')
    prompt = 'คำสั่งเขียนโค้ดภาษาไทยและอังกฤษ: React, Next.js, TypeScript, JavaScript, Python, npm, git, Docker, API, UI, HTML, CSS, component, function, test, build, dev'
    segments, info = model.transcribe(
        args.audio,
        language=None if args.language == 'auto' else args.language,
        initial_prompt=prompt,
        vad_filter=True,
        beam_size=5,
        condition_on_previous_text=False
    )
    text = ''.join(segment.text for segment in segments).strip()
    print(json.dumps({'text': text, 'language': info.language}, ensure_ascii=True))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=True))
        sys.exit(1)
