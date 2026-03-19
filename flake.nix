{
  description = "Development shell for oc-force-beads";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      linuxSystems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllLinuxSystems = nixpkgs.lib.genAttrs linuxSystems;
    in {
      devShells = forAllLinuxSystems (
        system:
        let
          pkgs = import nixpkgs {
            inherit system;
          };
        in {
          default = pkgs.mkShell {
            packages = with pkgs; [
              bun
              nodejs_24
              git
            ];
          };
        }
      );
    };
}
