import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./config";
import { OceanScene } from "./scenes/OceanScene";
import "./style.css";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "app",
  backgroundColor: "#8ed6f5",
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },
  scene: OceanScene,
};

new Phaser.Game(config);
