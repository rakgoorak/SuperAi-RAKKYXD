cask "superai-rakkyxd" do
  version "1.0.44"
  name "SuperAi & RAKKYXD"
  desc "Local-first desktop workspace for multiple AI coding assistants"
  homepage "https://github.com/rakgoorak/SuperAi-RAKKYXD"

  on_arm do
    sha256 "9bd107d1a287e98608882fbfc7a2bcec1cc609511140aa9145acb5bcf6495caf"
    url "https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/download/v#{version}/SuperAi-RAKKYXD-macos-arm64.dmg",
        verified: "github.com/rakgoorak/SuperAi-RAKKYXD-releases/"
  end

  on_intel do
    sha256 "b03ac3068b9a1af867b1452e1f692154f2647f1ab6a388e4392ff8ecad6576a7"
    url "https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/download/v#{version}/SuperAi-RAKKYXD-macos-x64.dmg",
        verified: "github.com/rakgoorak/SuperAi-RAKKYXD-releases/"
  end

  depends_on macos: ">= :big_sur"

  app "SuperAi-RAKKYXD.app"

  zap trash: [
    "~/.opencode-multi",
  ]
end
