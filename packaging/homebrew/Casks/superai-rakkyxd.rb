cask "superai-rakkyxd" do
  version "1.0.45"
  name "SuperAi & RAKKYXD"
  desc "Local-first desktop workspace for multiple AI coding assistants"
  homepage "https://github.com/rakgoorak/SuperAi-RAKKYXD"

  on_arm do
    sha256 "6281360fa355e8f832daec5852771a1fcfc184271d07afad68ce9b4dc54120e7"
    url "https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/download/v#{version}/SuperAi-RAKKYXD-macos-arm64.dmg",
        verified: "github.com/rakgoorak/SuperAi-RAKKYXD-releases/"
  end

  on_intel do
    sha256 "b8eefd63e6a3074faaa3d078dc18dcbb6c7e12a3438425628855a7149d983c5b"
    url "https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/download/v#{version}/SuperAi-RAKKYXD-macos-x64.dmg",
        verified: "github.com/rakgoorak/SuperAi-RAKKYXD-releases/"
  end

  depends_on macos: ">= :big_sur"

  app "SuperAi-RAKKYXD.app"

  zap trash: [
    "~/.opencode-multi",
  ]
end
