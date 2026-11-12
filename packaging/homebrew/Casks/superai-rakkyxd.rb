cask "superai-rakkyxd" do
  version "1.0.47"
  name "SuperAi & RAKKYXD"
  desc "Local-first desktop workspace for multiple AI coding assistants"
  homepage "https://github.com/rakgoorak/SuperAi-RAKKYXD"

  on_arm do
    sha256 "dc686a64e8b76e195a8e89f74d59c08c6281a5ce5875afda60a394031a64aa54"
    url "https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/download/v#{version}/SuperAi-RAKKYXD-macos-arm64.dmg",
        verified: "github.com/rakgoorak/SuperAi-RAKKYXD-releases/"
  end

  on_intel do
    sha256 "c2add89b17d6f727d7a25b18f7d954e26658a4a5ec222227bc9b3df4eb592b94"
    url "https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/download/v#{version}/SuperAi-RAKKYXD-macos-x64.dmg",
        verified: "github.com/rakgoorak/SuperAi-RAKKYXD-releases/"
  end

  depends_on macos: ">= :big_sur"

  app "SuperAi-RAKKYXD.app"

  zap trash: [
    "~/.opencode-multi",
  ]
end
