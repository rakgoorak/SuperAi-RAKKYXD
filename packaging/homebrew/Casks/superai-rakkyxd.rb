cask "superai-rakkyxd" do
  version "1.0.48"
  name "SuperAi & RAKKYXD"
  desc "Local-first desktop workspace for multiple AI coding assistants"
  homepage "https://github.com/rakgoorak/SuperAi-RAKKYXD"

  on_arm do
    sha256 "7b9a5b4940b885a0ef6cb425d13c7cc61800c67d2d0e864cc14acb799997830d"
    url "https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/download/v#{version}/SuperAi-RAKKYXD-macos-arm64.dmg",
        verified: "github.com/rakgoorak/SuperAi-RAKKYXD-releases/"
  end

  on_intel do
    sha256 "25e900a7af527849ce379cde483430532acfed3360e0a833a9b93a2e36426500"
    url "https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/download/v#{version}/SuperAi-RAKKYXD-macos-x64.dmg",
        verified: "github.com/rakgoorak/SuperAi-RAKKYXD-releases/"
  end

  depends_on macos: ">= :big_sur"

  app "SuperAi-RAKKYXD.app"

  zap trash: [
    "~/.opencode-multi",
  ]
end
