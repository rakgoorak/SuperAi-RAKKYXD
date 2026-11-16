# Signing the macOS app

macOS remembers the Accessibility and Screen Recording permissions by the app's code signature.
An ad-hoc signature (`codesign --sign -`) changes with every build, so each update silently drops
the user's permissions (the switch in System Settings still shows "on"). Every release is
therefore signed with the same certificate, set in two repository secrets:

| Secret | Content |
|---|---|
| `APPLE_CERTIFICATE_BASE64` | the `.p12`, base64 on one line |
| `APPLE_CERTIFICATE_PASSWORD` | its password |

`release.yml` imports it on the macOS runners, trusts it for code signing there if it is
self-signed, signs the app by the certificate's SHA-1 and prints the designated requirement
(it must name the certificate, not a build hash). An Apple Developer ID certificate works the
same way and also removes the "unidentified developer" warning once notarized.

## The free (self-signed) certificate

The current one, valid until 2036, was made like this; keep its folder backed up and never commit it:

```bash
# cert.cnf: CN = SuperAi RAKKYXD Code Signing, keyUsage digitalSignature, extendedKeyUsage codeSigning
openssl req -new -x509 -newkey rsa:3072 -sha256 -days 3650 -nodes -keyout key.pem -out cert.pem -config cert.cnf
openssl rand -base64 24 | tr -d '\r\n' > p12-password.txt      # no line break: Windows OpenSSL writes \r\n
openssl pkcs12 -export -legacy -inkey key.pem -in cert.pem -name "SuperAi RAKKYXD Code Signing" \
  -certpbe PBE-SHA1-3DES -keypbe PBE-SHA1-3DES -macalg sha1 \
  -passout file:p12-password.txt -out superai-mac-signing.p12
base64 -w0 superai-mac-signing.p12 > superai-mac-signing.p12.base64.txt
rm key.pem
```

Two traps, both reported by macOS as "The user name or passphrase you entered is not correct":

- **Format:** `security import` cannot read a `.p12` whose certificate is RC2-encrypted (the
  `-legacy` default) or AES-encrypted (the OpenSSL 3 default). Use 3DES with a SHA-1 MAC as above.
- **Line breaks:** a password file with a trailing `\r` or `\n` becomes part of the password. The
  workflow drops line breaks from both secrets, so the `.p12` must be made with a password that has none.

Set the secrets from Git Bash (a file redirect adds nothing):

```bash
gh secret set APPLE_CERTIFICATE_BASE64 --repo rakgoorak/SuperAi-RAKKYXD < superai-mac-signing.p12.base64.txt
gh secret set APPLE_CERTIFICATE_PASSWORD --repo rakgoorak/SuperAi-RAKKYXD < p12-password.txt
```

Changing the certificate (a new one, or moving to a Developer ID) changes the signature once:
Mac users grant the permissions again after that update (Settings > AI control has "Reset").
