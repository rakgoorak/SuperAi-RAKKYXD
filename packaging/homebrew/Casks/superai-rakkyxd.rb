cask "superai-rakkyxd" do
  version "1.2.6"
  name "SuperAi & RAKKYXD"
  desc "Local-first desktop workspace for multiple AI coding assistants"
  homepage "https://github.com/rakgoorak/SuperAi-RAKKYXD"

  on_arm do
    sha256 "5d768c618e53f404d3d7d8baf7abab52d70a4a309933761c485438561740d7a4"
    url "https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/download/v#{version}/SuperAi-RAKKYXD-macos-arm64.dmg",
        verified: "github.com/rakgoorak/SuperAi-RAKKYXD-releases/"
  end

  on_intel do
    sha256 "c0251603f6cc7e30e68625d915b76590414bdd486a7bc40dd5f3da102517670b"
    url "https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/download/v#{version}/SuperAi-RAKKYXD-macos-x64.dmg",
        verified: "github.com/rakgoorak/SuperAi-RAKKYXD-releases/"
  end

  depends_on macos: ">= :ventura"

  app "SuperAi-RAKKYXD.app"

  zap trash: [
    "~/.opencode-multi",
  ]
end
