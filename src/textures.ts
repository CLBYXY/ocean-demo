import Phaser from "phaser";

export function createGameTextures(scene: Phaser.Scene) {
  createBoatTexture(scene);
  createDiverTexture(scene);
  createGarbageTextures(scene);
  createFishTextures(scene);
  createNetTexture(scene);
}

function createBoatTexture(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.fillStyle(0x7b4a2b, 1);
  g.fillTriangle(8, 18, 128, 18, 104, 48);
  g.fillRect(24, 18, 80, 26);
  g.lineStyle(4, 0x2c241c, 1);
  g.strokeTriangle(8, 18, 128, 18, 104, 48);
  g.strokeRect(24, 18, 80, 26);
  g.fillStyle(0xf2e6bb, 1);
  g.fillTriangle(62, 14, 62, -36, 100, 14);
  g.lineStyle(3, 0x3a4758, 1);
  g.lineBetween(62, 16, 62, -38);
  g.generateTexture("boat", 136, 86);
  g.destroy();

  const upgraded = scene.add.graphics();
  upgraded.fillStyle(0x245f91, 1);
  upgraded.fillTriangle(0, 22, 178, 22, 142, 62);
  upgraded.fillRect(25, 14, 118, 38);
  upgraded.fillStyle(0x7ec8ff, 1);
  upgraded.fillRect(52, 6, 56, 12);
  upgraded.fillStyle(0xf4e6b8, 1);
  upgraded.fillTriangle(80, 12, 80, -48, 132, 12);
  upgraded.lineStyle(4, 0x13253a, 1);
  upgraded.strokeTriangle(0, 22, 178, 22, 142, 62);
  upgraded.strokeRect(25, 14, 118, 38);
  upgraded.lineBetween(80, 14, 80, -50);
  upgraded.generateTexture("boat-upgraded", 184, 104);
  upgraded.destroy();
}

function createDiverTexture(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.fillStyle(0xf7c99a, 1);
  g.fillCircle(18, 12, 9);
  g.fillStyle(0xffd34d, 1);
  g.fillRoundedRect(9, 21, 18, 28, 8);
  g.fillStyle(0x12335a, 1);
  g.fillRect(6, 48, 8, 18);
  g.fillRect(22, 48, 8, 18);
  g.fillStyle(0x7fd7ff, 1);
  g.fillRoundedRect(10, 7, 16, 8, 4);
  g.lineStyle(3, 0x12243b, 1);
  g.strokeCircle(18, 12, 10);
  g.strokeRoundedRect(9, 21, 18, 28, 8);
  g.generateTexture("diver", 36, 70);
  g.destroy();
}

function createGarbageTextures(scene: Phaser.Scene) {
  const bottle = scene.add.graphics();
  bottle.fillStyle(0xdff7ff, 1);
  bottle.fillRoundedRect(8, 8, 25, 40, 8);
  bottle.fillStyle(0x5bbf72, 1);
  bottle.fillRect(14, 1, 13, 10);
  bottle.lineStyle(3, 0x1d8baa, 1);
  bottle.strokeRoundedRect(8, 8, 25, 40, 8);
  bottle.generateTexture("trash-bottle", 42, 52);
  bottle.destroy();

  const bag = scene.add.graphics();
  bag.fillStyle(0xe8e0d6, 1);
  bag.fillRoundedRect(5, 10, 38, 30, 8);
  bag.fillStyle(0xc9beb2, 1);
  bag.fillTriangle(12, 12, 23, 2, 34, 12);
  bag.lineStyle(3, 0x85766a, 1);
  bag.strokeRoundedRect(5, 10, 38, 30, 8);
  bag.generateTexture("trash-bag", 48, 48);
  bag.destroy();

  const can = scene.add.graphics();
  can.fillStyle(0xe95a5a, 1);
  can.fillRoundedRect(6, 5, 34, 32, 7);
  can.fillStyle(0xffffff, 0.65);
  can.fillRect(12, 13, 22, 6);
  can.lineStyle(3, 0x7a2525, 1);
  can.strokeRoundedRect(6, 5, 34, 32, 7);
  can.generateTexture("trash-can", 46, 42);
  can.destroy();
}

function createFishTextures(scene: Phaser.Scene) {
  createFishTexture(scene, "fish-small", 0x9be7ff, 34, 16);
  createFishTexture(scene, "fish-mid", 0x6adf9b, 58, 26);
  createFishTexture(scene, "fish-deep", 0xff6464, 92, 42);
}

function createFishTexture(scene: Phaser.Scene, key: string, color: number, width: number, height: number) {
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.fillEllipse(width * 0.48, height * 0.5, width * 0.72, height);
  g.fillTriangle(width * 0.86, height * 0.5, width, 0, width, height);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(width * 0.24, height * 0.38, Math.max(2, height * 0.12));
  g.fillStyle(0x132238, 1);
  g.fillCircle(width * 0.25, height * 0.38, Math.max(1, height * 0.06));
  g.lineStyle(2, 0x172236, 0.65);
  g.strokeEllipse(width * 0.48, height * 0.5, width * 0.72, height);
  g.generateTexture(key, width, height);
  g.destroy();
}

function createNetTexture(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.lineStyle(3, 0xe8fbff, 0.92);
  g.strokeCircle(48, 48, 42);
  g.lineStyle(1, 0xb8f1ff, 0.62);

  for (let i = 14; i <= 82; i += 14) {
    g.lineBetween(i, 10, i, 86);
    g.lineBetween(10, i, 86, i);
  }

  g.generateTexture("net", 96, 96);
  g.destroy();
}
