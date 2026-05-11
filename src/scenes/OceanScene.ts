import Phaser from "phaser";
import {
  BASE_OXYGEN,
  BASE_PRESSURE_DEPTH,
  BOAT_SPEED,
  GAME_HEIGHT,
  GAME_WIDTH,
  NET_FLIGHT_TIME,
  NET_RANGE,
  PLAYER_SPEED,
  SEA_FLOOR,
  SEA_LEVEL,
  VACUUM_POWER,
  VACUUM_RANGE,
  WORLD_HEIGHT,
} from "../config";
import { FISH_META, type FishKind } from "../gameTypes";
import { createGameTextures } from "../textures";
import { FishHotbar } from "../ui/FishHotbar";
import { PondPanel } from "../ui/PondPanel";

type ControlKeys = Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
type UpgradeKind = "net" | "vacuum" | "suit" | "pond";
type DecorationKind = "trident" | "poseidon";

const MAX_BOAT_LEVEL = 5;
const BOAT_TRASH_REQUIREMENTS = [0, 5, 8, 12, 16];
const POND_BASE_CAPACITY = 6;

type Fish = {
  sprite: Phaser.GameObjects.Image;
  kind: FishKind;
  speed: number;
  baseY: number;
  captured: boolean;
};

type OilPatch = {
  shape: Phaser.GameObjects.Ellipse;
  cleanup: number;
};

type CarriedTrash = {
  sprite: Phaser.GameObjects.Image;
  texture: string;
};

type ShopButton = {
  rect: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  action: () => void;
};

type DecorationCollectible = {
  kind: DecorationKind;
  label: string;
  object: Phaser.GameObjects.Container;
  collected: boolean;
};

type PlacedDecoration = {
  kind: DecorationKind;
  object: Phaser.GameObjects.Container;
  offsetX: number;
  offsetY: number;
};

export class OceanScene extends Phaser.Scene {
  private boat!: Phaser.GameObjects.Image;
  private furnace!: Phaser.GameObjects.Rectangle;
  private fishCrate!: Phaser.GameObjects.Rectangle;
  private fishPond!: Phaser.GameObjects.Ellipse;
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private keys!: ControlKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private pKey!: Phaser.Input.Keyboard.Key;
  private fKey!: Phaser.Input.Keyboard.Key;
  private jKey!: Phaser.Input.Keyboard.Key;
  private kKey!: Phaser.Input.Keyboard.Key;
  private bKey!: Phaser.Input.Keyboard.Key;
  private trash!: Phaser.Physics.Arcade.Group;
  private inventoryText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private diveText!: Phaser.GameObjects.Text;
  private fishHotbar!: FishHotbar;
  private pondPanel!: PondPanel;
  private furnaceBar!: Phaser.GameObjects.Rectangle;
  private purifyBar!: Phaser.GameObjects.Rectangle;
  private struggleBar!: Phaser.GameObjects.Rectangle;
  private strugglePanel!: Phaser.GameObjects.Container;
  private decorationPanel!: Phaser.GameObjects.Container;
  private placementZone!: Phaser.GameObjects.Rectangle;
  private shopPanel!: Phaser.GameObjects.Container;
  private shopPanelBg!: Phaser.GameObjects.Rectangle;
  private shopButtons: ShopButton[] = [];
  private trajectory!: Phaser.GameObjects.Graphics;
  private vacuumRing!: Phaser.GameObjects.Arc;
  private vacuumNozzle!: Phaser.GameObjects.Rectangle;
  private netSprite!: Phaser.GameObjects.Image;
  private netRing!: Phaser.GameObjects.Arc;
  private reefChest!: Phaser.GameObjects.Rectangle;
  private chestLabel!: Phaser.GameObjects.Text;
  private unlockText!: Phaser.GameObjects.Text;
  private fish: Fish[] = [];
  private oilPatches: OilPatch[] = [];
  private carriedTrash: CarriedTrash[] = [];
  private caughtFish: Record<FishKind, number> = { small: 0, mid: 0, deep: 0 };
  private pondFish: Record<FishKind, number> = { small: 0, mid: 0, deep: 0 };
  private totalTrashCount = 0;
  private cleanedTrashCount = 0;
  private collectedTrash = 0;
  private gold = 0;
  private boatLevel = 1;
  private furnaceProgress = 0;
  private furnaceFeedTimer = 0;
  private pondLevel = 1;
  private vacuumLevel = 1;
  private netLevel = 1;
  private suitLevel = 1;
  private oxygen = BASE_OXYGEN;
  private pressureLevel = 1;
  private onBoat = true;
  private isDead = false;
  private facing = 1;
  private aiming = false;
  private netFlying = false;
  private netActive = false;
  private fishingFocusMode = false;
  private netFlightTween?: Phaser.Tweens.Tween;
  private netResetEvent?: Phaser.Time.TimerEvent;
  private struggle = 0;
  private capturedFish?: Fish;
  private selectedFish: FishKind = "small";
  private decorationCollectibles: DecorationCollectible[] = [];
  private decorationInventory: DecorationKind[] = [];
  private placedDecorations: PlacedDecoration[] = [];
  private selectedDecoration?: DecorationKind;
  private placingDecoration = false;
  private shopOpen = false;
  private shopClosing = false;
  private chestOpened = false;
  private atlantisUnlocked = false;

  constructor() {
    super("OceanScene");
  }

  create() {
    createGameTextures(this);

    this.physics.world.setBounds(0, 0, GAME_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, WORLD_HEIGHT);

    this.createWorld();
    this.createBoatAndPlayer();
    this.createTrash();
    this.createFish();
    this.createReefAndChest();
    this.createAtlantis();
    this.createHud();
    this.createControls();
    this.createFishingInput();

    this.physics.add.overlap(
      this.player,
      this.trash,
      (_player, item) => this.collectTrash(item as Phaser.Physics.Arcade.Sprite),
      undefined,
      this,
    );

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08, 0, 105);
  }

  update(_time: number, delta: number) {
    const deltaSeconds = delta / 1000;

    if (this.isDead) {
      this.updateFish(deltaSeconds);
      this.refreshHud();
      return;
    }

    this.updateBoat(deltaSeconds);
    this.updatePlayer();
    this.updateCarriedTrash();
    this.updateFish(deltaSeconds);
    this.updateVacuum(deltaSeconds);
    this.updateFurnace(deltaSeconds);
    this.updateFishing(deltaSeconds);
    this.updateChest();
    this.updateDiving(deltaSeconds);
    this.updateFishStorage();
    this.updatePondUi(deltaSeconds);
    this.updateDecorationSystem();
    this.updateShopAutoClose();
    this.refreshHud();
  }

  private createWorld() {
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x86d8f6, 0x86d8f6, 0xf8dca6, 0xf8dca6, 1);
    sky.fillRect(0, 0, GAME_WIDTH, SEA_LEVEL);

    for (let i = 0; i < 5; i += 1) {
      const cloudX = 95 + i * 190;
      const cloudY = 50 + (i % 2) * 34;
      this.add.ellipse(cloudX, cloudY, 64, 22, 0xffffff, 0.42);
      this.add.ellipse(cloudX + 34, cloudY + 3, 86, 26, 0xffffff, 0.32);
    }

    const water = this.add.graphics();
    water.fillGradientStyle(0x179bd0, 0x179bd0, 0x021c3f, 0x021c3f, 1);
    water.fillRect(0, SEA_LEVEL, GAME_WIDTH, WORLD_HEIGHT - SEA_LEVEL);

    const surface = this.add.graphics();
    surface.lineStyle(5, 0xc6f7ff, 0.9);
    surface.beginPath();
    for (let x = -20; x <= GAME_WIDTH + 20; x += 20) {
      const y = SEA_LEVEL + Math.sin(x * 0.045) * 6;
      if (x === -20) {
        surface.moveTo(x, y);
      } else {
        surface.lineTo(x, y);
      }
    }
    surface.strokePath();

    const rays = this.add.graphics();
    for (let i = 0; i < 9; i += 1) {
      rays.fillStyle(0xbbefff, 0.06);
      rays.fillTriangle(80 + i * 105, SEA_LEVEL, 150 + i * 90, SEA_LEVEL, 20 + i * 96, SEA_LEVEL + 740);
    }

    const bubbles = this.add.graphics();
    for (let i = 0; i < 65; i += 1) {
      bubbles.fillStyle(0xbaf6ff, Phaser.Math.FloatBetween(0.08, 0.2));
      bubbles.fillCircle(Phaser.Math.Between(20, GAME_WIDTH - 20), Phaser.Math.Between(SEA_LEVEL + 80, SEA_FLOOR - 60), Phaser.Math.Between(2, 6));
    }

    const floor = this.add.graphics();
    floor.fillStyle(0x27334a, 1);
    floor.fillRect(0, SEA_FLOOR, GAME_WIDTH, WORLD_HEIGHT - SEA_FLOOR);
    floor.fillStyle(0x3b4965, 1);
    floor.fillTriangle(0, SEA_FLOOR, 180, SEA_FLOOR - 55, 360, SEA_FLOOR);
    floor.fillTriangle(570, SEA_FLOOR, 780, SEA_FLOOR - 70, GAME_WIDTH, SEA_FLOOR);
  }

  private createBoatAndPlayer() {
    this.boat = this.add.image(GAME_WIDTH / 2, SEA_LEVEL - 22, "boat").setDepth(5);
    this.furnace = this.add.rectangle(this.boat.x - 18, SEA_LEVEL - 74, 34, 42, 0x4b2631, 1).setDepth(7);
    this.furnace.setStrokeStyle(3, 0xffb14d, 0.85);
    this.fishCrate = this.add.rectangle(this.boat.x + 42, SEA_LEVEL - 54, 42, 24, 0x8a5a32, 1).setDepth(7);
    this.fishCrate.setStrokeStyle(2, 0xf0c082, 1);
    this.fishPond = this.add.ellipse(this.boat.x + 82, SEA_LEVEL - 61, 46, 22, 0x68daf2, 0.82).setDepth(7);
    this.fishPond.setInteractive({ useHandCursor: true });

    this.player = this.physics.add.sprite(this.boat.x, SEA_LEVEL - 74, "diver");
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(9);
    this.player.body.setSize(24, 50);
    this.player.body.setOffset(6, 12);
    this.snapPlayerToBoat();
  }

  private createTrash() {
    this.trash = this.physics.add.group();
    const trashKeys = ["trash-bottle", "trash-bag", "trash-can"];

    this.totalTrashCount = 24;

    for (let i = 0; i < this.totalTrashCount; i += 1) {
      const nearSurface = i < 10;
      const midWater = i >= 10 && i < 16;
      const y = nearSurface
        ? Phaser.Math.Between(SEA_LEVEL + 20, SEA_LEVEL + 150)
        : midWater
          ? Phaser.Math.Between(SEA_LEVEL + 430, SEA_LEVEL + 920)
          : Phaser.Math.Between(SEA_FLOOR - 330, SEA_FLOOR - 50);
      const item = this.trash.create(
        Phaser.Math.Between(70, GAME_WIDTH - 70),
        y,
        trashKeys[i % trashKeys.length],
      ) as Phaser.Physics.Arcade.Sprite;

      item.setData("textureKey", trashKeys[i % trashKeys.length]);
      item.setRotation(Phaser.Math.FloatBetween(-0.8, 0.8));
      item.setVelocity(Phaser.Math.Between(-18, 18), Phaser.Math.Between(-12, 12));
      item.setBounce(1, 1);
      item.setCollideWorldBounds(true);
      item.body?.setCircle(20);

      this.tweens.add({
        targets: item,
        y: item.y + Phaser.Math.Between(-14, 14),
        duration: Phaser.Math.Between(1400, 2600),
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
    }
  }

  private createFish() {
    this.addFishLayer("fish-small", "small", 14, SEA_LEVEL + 90, SEA_LEVEL + 420, 0.75, 28, 50);
    this.addFishLayer("fish-mid", "mid", 10, SEA_LEVEL + 520, SEA_LEVEL + 980, 0.95, 42, 75);
    this.addFishLayer("fish-deep", "deep", 7, SEA_LEVEL + 1120, SEA_FLOOR - 230, 1.2, 58, 96);
  }

  private addFishLayer(
    texture: string,
    kind: FishKind,
    count: number,
    minY: number,
    maxY: number,
    scale: number,
    minSpeed: number,
    maxSpeed: number,
  ) {
    for (let i = 0; i < count; i += 1) {
      const direction = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
      const sprite = this.add.image(
        Phaser.Math.Between(50, GAME_WIDTH - 50),
        Phaser.Math.Between(minY, maxY),
        texture,
      );
      sprite.setScale(scale * direction, scale);
      sprite.setAlpha(kind === "deep" ? 0.9 : 0.78);
      sprite.setDepth(3);

      this.fish.push({
        sprite,
        kind,
        speed: Phaser.Math.Between(minSpeed, maxSpeed) * direction,
        baseY: sprite.y,
        captured: false,
      });
    }
  }

  private createReefAndChest() {
    const reef = this.add.graphics();
    reef.fillStyle(0x43526b, 1);
    reef.fillTriangle(690, SEA_LEVEL + 870, 830, SEA_LEVEL + 610, 940, SEA_LEVEL + 870);
    reef.fillStyle(0x566882, 1);
    reef.fillTriangle(760, SEA_LEVEL + 870, 900, SEA_LEVEL + 690, 990, SEA_LEVEL + 870);
    reef.fillStyle(0x6a4a71, 0.9);
    reef.fillCircle(832, SEA_LEVEL + 805, 28);
    reef.fillCircle(884, SEA_LEVEL + 790, 18);
    reef.setDepth(2);

    this.reefChest = this.add.rectangle(835, SEA_LEVEL + 604, 58, 34, 0x9a612c, 1).setDepth(4);
    this.reefChest.setStrokeStyle(3, 0xffda75, 1);
    this.chestLabel = this.add.text(796, SEA_LEVEL + 562, "按 F 打开宝箱", {
      fontFamily: "Arial, sans-serif",
      fontSize: "16px",
      color: "#fff7c8",
      fontStyle: "bold",
    }).setDepth(5).setVisible(false);
  }

  private createAtlantis() {
    const ruin = this.add.graphics();
    const baseY = SEA_FLOOR - 10;
    ruin.fillStyle(0x50637d, 1);
    ruin.fillRect(245, baseY - 180, 470, 180);
    ruin.fillStyle(0x6f84a1, 1);
    ruin.fillTriangle(215, baseY - 180, 480, baseY - 330, 745, baseY - 180);
    ruin.fillStyle(0x3f5069, 1);
    ruin.fillRect(305, baseY - 245, 52, 245);
    ruin.fillRect(425, baseY - 285, 70, 285);
    ruin.fillRect(603, baseY - 245, 52, 245);
    ruin.fillStyle(0x101a2a, 0.5);
    ruin.fillRoundedRect(449, baseY - 96, 62, 96, 28);
    ruin.lineStyle(4, 0xa8c6d4, 0.45);
    ruin.strokeTriangle(215, baseY - 180, 480, baseY - 330, 745, baseY - 180);
    ruin.strokeRect(245, baseY - 180, 470, 180);
    ruin.setDepth(1);

    const positions = [
      [315, baseY - 205, 92, 58],
      [425, baseY - 140, 120, 86],
      [515, baseY - 260, 135, 74],
      [620, baseY - 95, 126, 90],
      [370, baseY - 42, 150, 62],
      [560, baseY - 175, 112, 70],
      [480, baseY - 70, 86, 72],
    ];

    positions.forEach(([x, y, width, height]) => {
      const patch = this.add.ellipse(x, y, width, height, 0x020204, 0.88);
      patch.setDepth(4);
      this.oilPatches.push({ shape: patch, cleanup: 0 });
    });

    this.unlockText = this.add.text(342, baseY - 360, "海神遗迹尚未净化", {
      fontFamily: "Arial, sans-serif",
      fontSize: "22px",
      color: "#9feaff",
      fontStyle: "bold",
    }).setDepth(5).setAlpha(0.65);
  }

  private createHud() {
    const panel = this.add.rectangle(18, 18, 240, 214, 0x071c2c, 0.78);
    panel.setOrigin(0, 0).setStrokeStyle(2, 0x8cecff, 0.35).setScrollFactor(0).setDepth(50);

    this.add.text(36, 32, "物品栏", {
      fontFamily: "Arial, sans-serif",
      fontSize: "18px",
      color: "#b9f3ff",
      fontStyle: "bold",
    }).setScrollFactor(0).setDepth(51);

    this.inventoryText = this.add.text(36, 62, "垃圾: 0", this.hudText(23)).setScrollFactor(0).setDepth(51);
    this.goldText = this.add.text(36, 94, "金币: 0", this.hudText(20)).setScrollFactor(0).setDepth(51);
    this.diveText = this.add.text(36, 124, "", this.hudText(14)).setScrollFactor(0).setDepth(51);

    this.add.text(36, 188, "P投炉 F宝箱 J卖鱼 K养鱼 空格互动", {
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      color: "#d8f9ff",
    }).setScrollFactor(0).setDepth(51);

    this.add.rectangle(320, 22, 170, 14, 0x091827, 0.8).setScrollFactor(0).setDepth(50);
    this.furnaceBar = this.add.rectangle(235, 22, 0, 14, 0xff994a, 0.95).setOrigin(0, 0.5).setScrollFactor(0).setDepth(51);
    this.add.text(318, 40, "船体升级", this.hudText(12)).setOrigin(0.5, 0).setScrollFactor(0).setDepth(51);

    this.add.rectangle(520, 22, 170, 14, 0x091827, 0.8).setScrollFactor(0).setDepth(50);
    this.purifyBar = this.add.rectangle(435, 22, 0, 14, 0x76dfff, 0.95).setOrigin(0, 0.5).setScrollFactor(0).setDepth(51);
    this.add.text(520, 40, "净化进度", this.hudText(12)).setOrigin(0.5, 0).setScrollFactor(0).setDepth(51);

    const shopButton = this.add.rectangle(GAME_WIDTH - 82, 36, 118, 42, 0x14324c, 0.9).setScrollFactor(0).setDepth(60);
    shopButton.setStrokeStyle(2, 0x9feaff, 0.7).setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH - 82, 25, "商城", this.hudText(20)).setOrigin(0.5, 0).setScrollFactor(0).setDepth(61);
    shopButton.on("pointerdown", () => this.openShop());
    this.createShopPanel();

    this.fishHotbar = new FishHotbar(this, GAME_WIDTH / 2, GAME_HEIGHT - 42, (kind) => {
      this.selectedFish = kind;
    });
    this.pondPanel = new PondPanel(this, this.fishPond);
    this.fishPond.on("pointerdown", () => this.pondPanel.show());

    this.trajectory = this.add.graphics().setDepth(45);
    this.netSprite = this.add.image(0, 0, "net").setVisible(false).setDepth(14);
    this.netRing = this.add.circle(0, 0, 75, 0x90efff, 0.12).setStrokeStyle(3, 0xe8fbff, 0.75).setVisible(false).setDepth(13);

    this.vacuumRing = this.add.circle(0, 0, VACUUM_RANGE, 0x9ff5ff, 0.1).setStrokeStyle(3, 0xaffbff, 0.45).setVisible(false).setDepth(12);
    this.vacuumNozzle = this.add.rectangle(0, 0, 62, 20, 0xf4f0de, 0.92).setStrokeStyle(3, 0x253346, 0.9).setVisible(false).setDepth(13);

    this.strugglePanel = this.add.container(GAME_WIDTH - 48, GAME_HEIGHT / 2).setDepth(70).setVisible(false);
    this.strugglePanel.add(this.add.rectangle(0, 0, 20, 170, 0x081827, 0.88).setStrokeStyle(2, 0xffffff, 0.35));
    this.struggleBar = this.add.rectangle(0, 78, 14, 156, 0xffdd66, 1).setOrigin(0.5, 1).setScale(1, 0);
    this.strugglePanel.add(this.struggleBar);

    this.placementZone = this.add.rectangle(0, 0, 160, 38, 0x38ff9f, 0.24)
      .setStrokeStyle(3, 0x78ffc1, 0.9)
      .setDepth(25)
      .setVisible(false);
    this.createDecorationPanel();
  }

  private hudText(size: number) {
    return {
      fontFamily: "Arial, sans-serif",
      fontSize: `${size}px`,
      color: "#ffffff",
      fontStyle: "bold",
    };
  }

  private createShopPanel() {
    this.shopPanel = this.add.container(GAME_WIDTH - 226, 72).setScrollFactor(0).setDepth(80).setVisible(false);
    this.shopPanelBg = this.add.rectangle(0, 0, 220, 238, 0x071c2c, 0.92).setOrigin(0, 0).setStrokeStyle(2, 0x9feaff, 0.45);
    this.shopPanelBg.setInteractive({ useHandCursor: false });
    this.shopPanel.add(this.shopPanelBg);
    this.shopPanel.add(this.add.text(16, 14, "升级商店", this.hudText(18)));
    this.addShopButton(16, 50, "渔网 +1  $25", () => this.buyUpgrade("net"));
    this.addShopButton(16, 94, "吸尘器 +1  $30", () => this.buyUpgrade("vacuum"));
    this.addShopButton(16, 138, "潜水服 +1  $35", () => this.buyUpgrade("suit"));
    this.addShopButton(16, 182, `鱼塘 +1  $${this.pondUpgradeCost()}`, () => this.buyUpgrade("pond"));
  }

  private createDecorationPanel() {
    this.decorationPanel = this.add.container(34, GAME_HEIGHT - 236).setScrollFactor(0).setDepth(88).setVisible(false);
    const bg = this.add.rectangle(0, 0, 230, 140, 0x061723, 0.94).setOrigin(0, 0).setStrokeStyle(2, 0x7deaff, 0.75);
    const title = this.add.text(16, 12, "装饰背包", this.hudText(18));
    const hint = this.add.text(16, 112, "点击装饰后，在船上点击摆放", {
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      color: "#bff7ff",
    });
    this.decorationPanel.add([bg, title, hint]);
  }

  private addShopButton(x: number, y: number, label: string, action: () => void) {
    const rect = this.add.rectangle(x, y, 188, 32, 0x163c59, 0.95).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    rect.setStrokeStyle(1, 0x91eaff, 0.45);
    const text = this.add.text(x + 12, y + 7, label, this.hudText(14));
    rect.on("pointerdown", action);
    this.shopPanel.add(rect);
    this.shopPanel.add(text);
    this.shopButtons.push({ rect, text, action });
  }

  private createControls() {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("Keyboard input is unavailable.");
    }

    this.keys = keyboard.addKeys("W,A,S,D") as ControlKeys;
    this.spaceKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.pKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.fKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.jKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.kKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.bKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
  }

  private createFishingInput() {
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && !this.onBoat && !this.netActive && !this.netFlying) {
        this.aiming = true;
      }

      if (pointer.rightButtonDown()) {
        this.cancelFishing();
      }
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonReleased() && this.aiming && !this.netFlying) {
        this.launchNet(pointer);
      }
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, targets: Phaser.GameObjects.GameObject[]) => {
      if (this.placingDecoration) {
        this.tryPlaceDecoration(pointer);
        return;
      }
      if (targets.includes(this.fishPond)) {
        return;
      }
      if (this.pondPanel?.isOpen() && !this.pondPanel.containsScreenPoint(pointer.x, pointer.y)) {
        this.pondPanel.hide();
      }
    });
  }

  private updateBoat(deltaSeconds: number) {
    let boatDirection = 0;

    if (this.onBoat) {
      if (this.keys.A.isDown) {
        boatDirection -= 1;
      }
      if (this.keys.D.isDown) {
        boatDirection += 1;
      }
    }

    this.boat.x = Phaser.Math.Clamp(this.boat.x + boatDirection * BOAT_SPEED * deltaSeconds, 95, GAME_WIDTH - 95);
    const boatBob = Math.sin(this.time.now * 0.003) * 3;
    this.boat.y = SEA_LEVEL - 22 + boatBob;
    this.furnace.setPosition(this.boat.x - 18, SEA_LEVEL - 74 + boatBob);
    this.fishCrate.setPosition(this.boat.x + 42, SEA_LEVEL - 54 + boatBob);
    this.fishPond.setPosition(this.boat.x + 84, SEA_LEVEL - 61 + boatBob);
    this.updatePlacedDecorations(boatBob);

    if (this.onBoat) {
      this.snapPlayerToBoat();
    }
  }

  private updatePlayer() {
    if (this.onBoat) {
      this.player.setVelocity(0, 0);
      if (Phaser.Input.Keyboard.JustDown(this.keys.S)) {
        this.onBoat = false;
        this.player.setPosition(this.boat.x, SEA_LEVEL + 34);
      }
      return;
    }

    const velocity = new Phaser.Math.Vector2(0, 0);
    if (this.keys.A.isDown) {
      velocity.x -= 1;
    }
    if (this.keys.D.isDown) {
      velocity.x += 1;
    }
    if (this.keys.W.isDown) {
      velocity.y -= 1;
    }
    if (this.keys.S.isDown) {
      velocity.y += 1;
    }

    velocity.normalize().scale(PLAYER_SPEED + (this.suitLevel - 1) * 24);
    this.player.setVelocity(velocity.x, velocity.y);

    if (velocity.x !== 0) {
      this.facing = velocity.x < 0 ? -1 : 1;
      this.player.setFlipX(this.facing < 0);
    }

    const maxDepth = SEA_LEVEL + BASE_PRESSURE_DEPTH + (this.suitLevel - 1) * 360;
    if (this.player.y > maxDepth) {
      this.player.y = maxDepth;
      this.player.setVelocityY(Math.min(0, this.player.body.velocity.y));
    }

    if (this.player.y <= SEA_LEVEL + 18 && this.keys.W.isDown) {
      this.onBoat = true;
      this.boat.x = Phaser.Math.Clamp(this.player.x, 95, GAME_WIDTH - 95);
      this.snapPlayerToBoat();
      this.oxygen = this.maxOxygen();
    }

    if (!this.onBoat && this.oxygen <= 0) {
      this.killPlayer();
    }
  }

  private updateCarriedTrash() {
    const backX = this.player.x - this.facing * 25;
    const backY = this.player.y + 5;

    this.carriedTrash.forEach((trash, index) => {
      const row = index % 4;
      const column = Math.floor(index / 4);
      const sway = Math.sin(this.time.now * 0.006 + index) * 4;
      trash.sprite.setPosition(backX - this.facing * row * 10 + sway, backY - column * 13 + row * 3);
      trash.sprite.setRotation(Math.sin(this.time.now * 0.004 + index) * 0.3);
      trash.sprite.setDepth(this.player.depth - 1);
    });
  }

  private updateFish(deltaSeconds: number) {
    this.fish.forEach((fish) => {
      if (fish.captured) {
        if (this.netActive) {
          const panic = this.time.now * 0.03;
          fish.sprite.x = this.netSprite.x + Math.sin(panic) * 38 + Phaser.Math.Between(-10, 10);
          fish.sprite.y = this.netSprite.y + Math.cos(panic * 1.3) * 32 + Phaser.Math.Between(-10, 10);
          fish.sprite.rotation += deltaSeconds * 14;
        }
        return;
      }

      fish.sprite.x += fish.speed * deltaSeconds;
      fish.sprite.y = fish.baseY + Math.sin((this.time.now + fish.sprite.x * 8) * 0.001) * 16;

      if (fish.sprite.x < -90) {
        fish.sprite.x = GAME_WIDTH + 90;
      } else if (fish.sprite.x > GAME_WIDTH + 90) {
        fish.sprite.x = -90;
      }
    });
  }

  private updateVacuum(deltaSeconds: number) {
    const nearAtlantis = Phaser.Math.Distance.Between(this.player.x, this.player.y, GAME_WIDTH / 2, SEA_FLOOR - 160) < 380;
    const active = !this.onBoat && nearAtlantis && this.spaceKey.isDown && !this.netActive;
    const range = VACUUM_RANGE + (this.vacuumLevel - 1) * 35;

    this.vacuumRing.setRadius(range);
    this.vacuumRing.setVisible(active);
    this.vacuumNozzle.setVisible(active);
    this.vacuumRing.setPosition(this.player.x, this.player.y);
    this.vacuumNozzle.setPosition(this.player.x + this.facing * 44, this.player.y + 10);
    this.vacuumNozzle.setScale(this.facing, 1);

    if (!active) {
      return;
    }

    this.oilPatches.forEach((patch) => {
      if (!patch.shape.active) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, patch.shape.x, patch.shape.y);
      if (distance > range) {
        return;
      }

      patch.cleanup = Phaser.Math.Clamp(patch.cleanup + (VACUUM_POWER + this.vacuumLevel * 0.08) * deltaSeconds, 0, 1);
      patch.shape.setAlpha(0.88 * (1 - patch.cleanup));
      patch.shape.setScale(1 - patch.cleanup * 0.45);
      this.spawnSpark(patch.shape.x, patch.shape.y, 0x111111);

      if (patch.cleanup >= 0.98) {
        patch.cleanup = 1;
        patch.shape.setVisible(false);
        patch.shape.setActive(false);
      }
    });

    this.checkAtlantisUnlock();
  }

  private updateFurnace(deltaSeconds: number) {
    if (!this.onBoat || !this.pKey.isDown || this.collectedTrash <= 0 || this.boatLevel >= MAX_BOAT_LEVEL) {
      this.furnaceFeedTimer = 0;
      return;
    }

    this.furnaceFeedTimer += deltaSeconds;
    if (this.furnaceFeedTimer < 0.24) {
      return;
    }

    this.furnaceFeedTimer = 0;
    this.collectedTrash -= 1;
    this.furnaceProgress += 1 / this.nextBoatRequirement();
    this.removeCarriedTrashVisual();
    this.spawnSpark(this.furnace.x, this.furnace.y, 0xff9c32);

    if (this.furnaceProgress >= 1) {
      this.upgradeBoat();
    }
  }

  private updateFishing(deltaSeconds: number) {
    this.trajectory.clear();

    if (this.aiming && !this.netFlying) {
      const pointer = this.input.activePointer;
      this.drawTrajectory(pointer.worldX, pointer.worldY);
    }

    if (this.netActive) {
      this.updateStrugglePanelPosition();
      if (Phaser.Math.Between(0, 5) === 0) {
        this.spawnSplash(this.netSprite.x, this.netSprite.y, 1);
      }
    }

    if (!this.netActive || !this.capturedFish) {
      return;
    }

    this.struggle = Phaser.Math.Clamp(this.struggle - deltaSeconds * (0.18 + this.capturedFish.kind.length * 0.01), 0, 1);
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.struggle = Phaser.Math.Clamp(this.struggle + 0.16 + this.netLevel * 0.03, 0, 1);
      this.spawnSpark(this.netSprite.x, this.netSprite.y, 0xffdd66);
    }

    this.struggleBar.setScale(1, this.struggle);
    if (this.struggle >= 1) {
      this.captureFish();
    } else if (this.struggle <= 0) {
      this.releaseFish();
    }
  }

  private updateChest() {
    if (this.tryCollectDecoration()) {
      return;
    }

    if (this.chestOpened) {
      this.chestLabel.setVisible(false);
      return;
    }

    const nearChest = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.reefChest.x, this.reefChest.y) < 82;
    this.chestLabel.setVisible(nearChest);

    if (nearChest && Phaser.Input.Keyboard.JustDown(this.fKey)) {
      this.chestOpened = true;
      this.reefChest.setFillStyle(0xd8b45f, 1);
      const roll = Phaser.Math.Between(0, 2);
      if (roll === 0) {
        this.netLevel += 1;
        this.flashText("宝箱: 高品质渔网");
      } else if (roll === 1) {
        this.vacuumLevel += 1;
        this.flashText("宝箱: 涡流吸尘工具");
      } else {
        this.gold += 45;
        this.flashText("宝箱: 古代金币");
      }
    }
  }

  private tryCollectDecoration() {
    const collectible = this.decorationCollectibles.find((item) => {
      return !item.collected && Phaser.Math.Distance.Between(this.player.x, this.player.y, item.object.x, item.object.y) < 92;
    });

    if (!collectible || !Phaser.Input.Keyboard.JustDown(this.fKey)) {
      return false;
    }

    collectible.collected = true;
    collectible.object.setVisible(false);
    if (!this.decorationInventory.includes(collectible.kind)) {
      this.decorationInventory.push(collectible.kind);
    }
    this.flashText(`${collectible.label}已进入装饰背包`);
    this.refreshDecorationPanel();
    return true;
  }

  private updateDiving(deltaSeconds: number) {
    if (this.onBoat) {
      this.oxygen = Phaser.Math.Clamp(this.oxygen + deltaSeconds * 42, 0, this.maxOxygen());
    } else {
      this.oxygen = Phaser.Math.Clamp(this.oxygen - deltaSeconds * 4.8, 0, this.maxOxygen());
    }

    const depth = Math.max(0, this.player.y - SEA_LEVEL);
    this.pressureLevel = Math.max(1, Math.ceil(depth / 360));
  }

  private updateFishStorage() {
    if (!this.onBoat) {
      return;
    }

    const totalFish = this.caughtFish.small + this.caughtFish.mid + this.caughtFish.deep;
    if (totalFish <= 0) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.jKey)) {
      this.sellOneFish();
    }

    if (Phaser.Input.Keyboard.JustDown(this.kKey)) {
      this.storeOneFishInPond();
    }
  }

  private updatePondUi(deltaSeconds: number) {
    this.pondPanel.update(this.pondFish, this.pondCapacity(), this.pondLevel);
    this.pondPanel.updateMotion(deltaSeconds);
  }

  private sellOneFish() {
    const kind = this.selectedFish;
    if (this.caughtFish[kind] <= 0) {
      this.flashText("该鱼类数量不足");
      return;
    }

    this.caughtFish[kind] -= 1;
    this.gold += this.fishValue(kind);
    this.spawnSpark(this.fishCrate.x, this.fishCrate.y, 0xffdc72);
    this.flashText(`卖出${this.fishKindName(kind)} +${this.fishValue(kind)}金币`);
    this.tweens.add({
      targets: this.fishCrate,
      scaleX: 1.16,
      scaleY: 1.16,
      duration: 90,
      yoyo: true,
    });
  }

  private storeOneFishInPond() {
    if (this.pondFishCount() >= this.pondCapacity()) {
      this.flashText("鱼塘已满");
      return;
    }

    const kind = this.selectedFish;
    if (this.caughtFish[kind] <= 0) {
      this.flashText(`没有可放养的${this.fishKindName(kind)}`);
      return;
    }

    this.caughtFish[kind] -= 1;
    this.pondFish[kind] += 1;
    this.spawnSpark(this.fishPond.x, this.fishPond.y, 0x7df5ff);
    this.flashText(`${this.fishKindName(kind)}已放入鱼塘`);
    this.tweens.add({
      targets: this.fishPond,
      scaleX: 1.22,
      scaleY: 1.22,
      duration: 120,
      yoyo: true,
    });
  }

  private fishValue(kind: FishKind) {
    return FISH_META[kind].price;
  }

  private drawTrajectory(targetX: number, targetY: number) {
    const start = new Phaser.Math.Vector2(this.player.x + this.facing * 18, this.player.y);
    const aim = new Phaser.Math.Vector2(targetX - start.x, targetY - start.y);
    aim.limit(NET_RANGE + (this.netLevel - 1) * 70);
    const end = start.clone().add(aim);
    const arcHeight = Phaser.Math.Clamp(Math.abs(aim.x) * 0.24 + 50, 50, 135);

    this.trajectory.lineStyle(3, 0xe8fbff, 0.82);
    for (let i = 0; i < 18; i += 2) {
      const t1 = i / 18;
      const t2 = (i + 1) / 18;
      const p1 = this.arcPoint(start, end, arcHeight, t1);
      const p2 = this.arcPoint(start, end, arcHeight, t2);
      this.trajectory.lineBetween(p1.x, p1.y, p2.x, p2.y);
    }
  }

  private cancelAim() {
    if (!this.aiming) {
      return;
    }

    this.aiming = false;
    this.trajectory.clear();
  }

  private cancelFishing() {
    if (this.aiming) {
      this.cancelAim();
      return;
    }

    if (this.netFlying || this.netActive || this.fishingFocusMode) {
      this.resetNet();
    }
  }

  private launchNet(pointer: Phaser.Input.Pointer) {
    this.aiming = false;
    this.netFlying = true;
    const start = new Phaser.Math.Vector2(this.player.x + this.facing * 18, this.player.y);
    const aim = new Phaser.Math.Vector2(pointer.worldX - start.x, pointer.worldY - start.y);
    aim.limit(NET_RANGE + (this.netLevel - 1) * 70);
    const end = start.clone().add(aim);
    const arcHeight = Phaser.Math.Clamp(Math.abs(aim.x) * 0.24 + 50, 50, 135);

    this.netSprite.setVisible(true).setPosition(start.x, start.y).setScale(0.58 + this.netLevel * 0.08);
    this.netFlightTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: NET_FLIGHT_TIME,
      ease: "Sine.easeOut",
      onUpdate: (tween) => {
        const point = this.arcPoint(start, end, arcHeight, tween.getValue() ?? 0);
        this.netSprite.setPosition(point.x, point.y);
        this.netSprite.rotation += 0.22;
      },
      onComplete: () => this.landNet(),
    });
  }

  private landNet() {
    this.netFlightTween = undefined;
    this.netFlying = false;
    this.netActive = true;
    this.fishingFocusMode = true;
    this.netRing.setVisible(true).setPosition(this.netSprite.x, this.netSprite.y);
    this.spawnSplash(this.netSprite.x, this.netSprite.y, 12);
    this.tweens.add({
      targets: [this.netSprite, this.netRing],
      angle: { from: -4, to: 4 },
      scale: { from: 0.94, to: 1.04 },
      duration: 110,
      yoyo: true,
      repeat: -1,
    });
    const caught = this.findFishInNet();

    if (!caught) {
      this.cameras.main.pan(this.netSprite.x, this.netSprite.y, 260, "Sine.easeInOut");
      this.cameras.main.zoomTo(1.08, 260);
      this.time.timeScale = 0.82;
      this.netResetEvent = this.time.delayedCall(650, () => this.resetNet());
      return;
    }

    this.capturedFish = caught;
    caught.captured = true;
    this.struggle = 0.42 + this.netLevel * 0.08;
    this.strugglePanel.setVisible(true);
    this.strugglePanel.setAlpha(0);
    this.strugglePanel.setScale(0.92);
    this.tweens.add({
      targets: this.strugglePanel,
      alpha: 1,
      scale: 1,
      duration: 180,
      ease: "Back.easeOut",
    });
    this.cameras.main.stopFollow();
    this.cameras.main.pan(this.netSprite.x, this.netSprite.y, 420, "Sine.easeInOut");
    this.cameras.main.zoomTo(1.18, 420);
    this.time.timeScale = 0.72;
    this.updateStrugglePanelPosition();
  }

  private findFishInNet() {
    const radius = 78 + this.netLevel * 14;
    return this.fish.find((fish) => {
      if (fish.captured || !fish.sprite.visible) {
        return false;
      }
      return Phaser.Math.Distance.Between(this.netSprite.x, this.netSprite.y, fish.sprite.x, fish.sprite.y) < radius;
    });
  }

  private captureFish() {
    if (!this.capturedFish) {
      return;
    }

    this.caughtFish[this.capturedFish.kind] += 1;
    this.capturedFish.sprite.setVisible(false);
    this.flashText(`捕鱼成功: ${this.fishKindName(this.capturedFish.kind)}`);
    this.resetNet();
  }

  private releaseFish() {
    if (this.capturedFish) {
      this.capturedFish.captured = false;
      this.capturedFish.sprite.rotation = 0;
    }
    this.flashText("鱼逃走了");
    this.resetNet();
  }

  private resetNet() {
    this.netFlightTween?.stop();
    this.netFlightTween = undefined;
    this.netResetEvent?.remove(false);
    this.netResetEvent = undefined;
    this.netActive = false;
    this.netFlying = false;
    this.fishingFocusMode = false;
    if (this.capturedFish) {
      this.capturedFish.captured = false;
      this.capturedFish.sprite.rotation = 0;
    }
    this.capturedFish = undefined;
    this.tweens.killTweensOf([this.netSprite, this.netRing]);
    this.tweens.killTweensOf(this.strugglePanel);
    this.netSprite.setAngle(0).setScale(0.58 + this.netLevel * 0.08);
    this.netRing.setAngle(0).setScale(1);
    this.netSprite.setVisible(false);
    this.netRing.setVisible(false);
    this.strugglePanel.setVisible(false);
    this.struggle = 0;
    this.struggleBar.setScale(1, 0);
    this.time.timeScale = 1;
    this.cameras.main.zoomTo(1, 350);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08, 0, 105);
  }

  private updateStrugglePanelPosition() {
    const view = this.cameras.main.worldView;
    this.strugglePanel.setPosition(view.right - 42, view.centerY);
    this.strugglePanel.setScale(1 / this.cameras.main.zoom);
  }

  private arcPoint(start: Phaser.Math.Vector2, end: Phaser.Math.Vector2, height: number, t: number) {
    return new Phaser.Math.Vector2(
      Phaser.Math.Linear(start.x, end.x, t),
      Phaser.Math.Linear(start.y, end.y, t) - Math.sin(t * Math.PI) * height,
    );
  }

  private snapPlayerToBoat() {
    this.player.setPosition(this.boat.x - 8, SEA_LEVEL - 76 + Math.sin(this.time.now * 0.003) * 3);
  }

  private killPlayer() {
    if (this.isDead) {
      return;
    }

    this.isDead = true;
    this.onBoat = false;
    this.cancelAim();
    this.resetNet();
    this.player.setVelocity(0, 0);
    this.player.setVisible(false);
    this.vacuumRing.setVisible(false);
    this.vacuumNozzle.setVisible(false);
    this.flashText("氧气耗尽");
    this.cameras.main.shake(260, 0.01);

    this.time.delayedCall(3000, () => this.respawnPlayer());
  }

  private respawnPlayer() {
    this.isDead = false;
    this.onBoat = true;
    this.oxygen = this.maxOxygen();
    this.player.setVisible(true);
    this.player.setVelocity(0, 0);
    this.player.setFlipX(false);
    this.facing = 1;
    this.snapPlayerToBoat();
    this.cameras.main.zoomTo(1, 250);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08, 0, 105);
    this.flashText("已在船上重生");
  }

  private collectTrash(item: Phaser.Physics.Arcade.Sprite) {
    const texture = String(item.getData("textureKey") ?? "trash-bag");
    item.disableBody(true, true);
    this.collectedTrash += 1;
    this.cleanedTrashCount += 1;

    const carried = this.add.image(this.player.x, this.player.y, texture);
    carried.setScale(0.34);
    carried.setAlpha(0.94);
    this.carriedTrash.push({ sprite: carried, texture });
    this.spawnSpark(this.player.x, this.player.y, 0xd8f7ff);
    this.checkAtlantisUnlock();
  }

  private removeCarriedTrashVisual() {
    const item = this.carriedTrash.shift();
    if (!item) {
      return;
    }

    this.tweens.add({
      targets: item.sprite,
      x: this.furnace.x,
      y: this.furnace.y,
      scale: 0.08,
      alpha: 0,
      duration: 180,
      onComplete: () => item.sprite.destroy(),
    });
  }

  private nextBoatRequirement() {
    return BOAT_TRASH_REQUIREMENTS[this.boatLevel] ?? BOAT_TRASH_REQUIREMENTS[BOAT_TRASH_REQUIREMENTS.length - 1];
  }

  private upgradeBoat() {
    this.boatLevel += 1;
    this.furnaceProgress = 0;
    this.boat.setTexture("boat-upgraded");
    this.boat.setScale(1 + (this.boatLevel - 2) * 0.16);
    this.furnace.setFillStyle(0x703443);
    this.flashText("船体升级完成");
    this.cameras.main.shake(220, 0.006);
  }

  private unlockAtlantisRewards() {
    this.atlantisUnlocked = true;
    this.unlockText.setText("遗迹装饰已出现，靠近按 F 收集");
    this.unlockText.setColor("#83f8ff");
    this.boat.setTint(0x68c9ff);

    const baseY = SEA_FLOOR - 10;
    this.spawnDecorationCollectible("poseidon", "海神雕像", 445, baseY - 355);
    this.spawnDecorationCollectible("trident", "三叉戟", 560, baseY - 345);
    this.flashText("亚特兰蒂斯净化完成，装饰已出现");
  }

  private checkAtlantisUnlock() {
    if (this.purification() >= 0.999 && !this.atlantisUnlocked) {
      this.unlockAtlantisRewards();
    }
  }

  private spawnDecorationCollectible(kind: DecorationKind, label: string, x: number, y: number) {
    const object = this.createDecorationObject(kind, x, y, 1.15);
    object.setDepth(7);
    const text = this.add.text(0, -58, `${label}\n按 F 收集`, {
      fontFamily: "Arial, sans-serif",
      fontSize: "15px",
      color: "#dffbff",
      align: "center",
      fontStyle: "bold",
      stroke: "#03131f",
      strokeThickness: 4,
    }).setOrigin(0.5, 0.5);
    object.add(text);
    this.tweens.add({
      targets: object,
      y: y - 8,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    this.decorationCollectibles.push({ kind, label, object, collected: false });
  }

  private createDecorationObject(kind: DecorationKind, x: number, y: number, scale = 1) {
    const container = this.add.container(x, y).setScale(scale);

    if (kind === "poseidon") {
      const halo = this.add.circle(0, -30, 22, 0x63d8ff, 0.34).setStrokeStyle(3, 0xc8fbff, 0.9);
      const body = this.add.rectangle(0, 12, 28, 72, 0x8fdcff, 0.82).setStrokeStyle(2, 0xd7fbff, 0.8);
      const head = this.add.circle(0, -30, 15, 0xbdefff, 0.92).setStrokeStyle(2, 0xffffff, 0.8);
      container.add([halo, body, head]);
    } else {
      const g = this.add.graphics();
      g.lineStyle(5, 0xaffbff, 1);
      g.lineBetween(0, -54, 0, 50);
      g.lineBetween(-20, -42, 0, -66);
      g.lineBetween(20, -42, 0, -66);
      g.lineBetween(0, -66, 0, -86);
      g.lineStyle(2, 0xffffff, 0.7);
      g.strokeCircle(0, -8, 10);
      container.add(g);
    }

    return container;
  }

  private buyUpgrade(kind: UpgradeKind) {
    const costs = { net: 25, vacuum: 30, suit: 35, pond: this.pondUpgradeCost() };
    if (this.gold < costs[kind]) {
      this.flashText("金币不足");
      return;
    }

    this.gold -= costs[kind];
    if (kind === "net") {
      this.netLevel += 1;
    } else if (kind === "vacuum") {
      this.vacuumLevel += 1;
    } else if (kind === "suit") {
      this.suitLevel += 1;
      this.oxygen = this.maxOxygen();
    } else {
      this.pondLevel += 1;
    }
    this.flashText(`${this.upgradeName(kind)}升级完成`);
  }

  private openShop() {
    this.shopOpen = true;
    this.shopClosing = false;
    this.shopPanel.setVisible(true);
    this.tweens.killTweensOf(this.shopPanel);
    this.shopPanel.setAlpha(0).setScale(0.96);
    this.tweens.add({
      targets: this.shopPanel,
      alpha: 1,
      scale: 1,
      duration: 160,
      ease: "Back.easeOut",
    });
  }

  private closeShop() {
    if (!this.shopOpen || this.shopClosing) {
      return;
    }

    this.shopClosing = true;
    this.tweens.killTweensOf(this.shopPanel);
    this.tweens.add({
      targets: this.shopPanel,
      alpha: 0,
      scale: 0.96,
      duration: 180,
      ease: "Sine.easeIn",
      onComplete: () => {
        this.shopOpen = false;
        this.shopClosing = false;
        this.shopPanel.setVisible(false);
      },
    });
  }

  private updateShopAutoClose() {
    if (!this.shopOpen || this.shopClosing) {
      return;
    }

    const pointer = this.input.activePointer;
    const left = GAME_WIDTH - 226;
    const top = 18;
    const right = GAME_WIDTH - 6;
    const bottom = 310;
    const insideShopArea = pointer.x >= left && pointer.x <= right && pointer.y >= top && pointer.y <= bottom;

    if (!insideShopArea) {
      this.closeShop();
    }
  }

  private updateDecorationSystem() {
    if (Phaser.Input.Keyboard.JustDown(this.bKey)) {
      this.toggleDecorationPanel();
    }

    if (this.placingDecoration) {
      this.updatePlacementZone();
    }
  }

  private toggleDecorationPanel() {
    const visible = !this.decorationPanel.visible;
    this.decorationPanel.setVisible(visible).setAlpha(visible ? 0 : 1);
    if (visible) {
      this.refreshDecorationPanel();
      this.tweens.add({ targets: this.decorationPanel, alpha: 1, duration: 160 });
    }
  }

  private refreshDecorationPanel() {
    if (!this.decorationPanel) {
      return;
    }

    const oldItems = this.decorationPanel.list.slice(3);
    oldItems.forEach((item) => {
      if (item instanceof Phaser.GameObjects.GameObject) {
        item.destroy();
      }
    });

    this.decorationInventory.forEach((kind, index) => {
      const x = 36 + index * 74;
      const y = 72;
      const bg = this.add.rectangle(x, y, 58, 58, 0x0f334a, 0.9)
        .setStrokeStyle(2, this.selectedDecoration === kind ? 0x91fff4 : 0x4aa5c7, 0.9)
        .setInteractive({ useHandCursor: true });
      const icon = this.createDecorationObject(kind, x, y + 4, 0.38);
      icon.setScrollFactor(0).setDepth(89);
      bg.on("pointerdown", () => this.selectDecoration(kind));
      this.decorationPanel.add([bg, icon]);
    });
  }

  private selectDecoration(kind: DecorationKind) {
    this.selectedDecoration = kind;
    this.placingDecoration = true;
    this.decorationPanel.setVisible(false);
    this.placementZone.setVisible(true);
    this.flashText(`${this.decorationName(kind)}: 选择船上位置`);
    this.refreshDecorationPanel();
  }

  private updatePlacementZone() {
    const width = 150 + (this.boatLevel - 1) * 28;
    this.placementZone.setSize(width, 42);
    this.placementZone.setDisplaySize(width, 42);
    this.placementZone.setPosition(this.boat.x, SEA_LEVEL - 88 + Math.sin(this.time.now * 0.003) * 3);
  }

  private tryPlaceDecoration(pointer: Phaser.Input.Pointer) {
    if (!this.selectedDecoration || !this.placementZone.visible) {
      return;
    }

    const zone = this.placementZone.getBounds();
    if (!zone.contains(pointer.worldX, pointer.worldY)) {
      this.flashText("只能摆放在绿色区域内");
      return;
    }

    const existing = this.placedDecorations.find((item) => item.kind === this.selectedDecoration);
    if (existing) {
      existing.offsetX = pointer.worldX - this.boat.x;
      existing.offsetY = pointer.worldY - this.boat.y;
      existing.object.setVisible(true);
    } else {
      const object = this.createDecorationObject(this.selectedDecoration, pointer.worldX, pointer.worldY, 0.45);
      object.setDepth(10);
      this.placedDecorations.push({
        kind: this.selectedDecoration,
        object,
        offsetX: pointer.worldX - this.boat.x,
        offsetY: pointer.worldY - this.boat.y,
      });
    }

    this.placingDecoration = false;
    this.placementZone.setVisible(false);
    this.flashText(`${this.decorationName(this.selectedDecoration)}已摆放`);
  }

  private updatePlacedDecorations(boatBob: number) {
    this.placedDecorations.forEach((item, index) => {
      item.object.setPosition(
        this.boat.x + item.offsetX,
        this.boat.y + item.offsetY + Math.sin(this.time.now * 0.004 + index) * 3 + boatBob * 0.2,
      );
    });
  }

  private decorationName(kind: DecorationKind) {
    return kind === "trident" ? "三叉戟" : "海神雕像";
  }

  private fishKindName(kind: FishKind) {
    return FISH_META[kind].name;
  }

  private upgradeName(kind: UpgradeKind) {
    if (kind === "net") {
      return "渔网";
    }
    if (kind === "vacuum") {
      return "吸尘器";
    }
    if (kind === "suit") {
      return "潜水服";
    }
    return "鱼塘";
  }

  private purification() {
    const oilProgress = this.oilPatches.reduce((sum, patch) => sum + patch.cleanup, 0) / this.oilPatches.length;
    const trashProgress = this.totalTrashCount === 0 ? 1 : this.cleanedTrashCount / this.totalTrashCount;
    return Phaser.Math.Clamp((oilProgress + trashProgress) / 2, 0, 1);
  }

  private maxOxygen() {
    return BASE_OXYGEN + (this.suitLevel - 1) * 35;
  }

  private pondCapacity() {
    return POND_BASE_CAPACITY + (this.pondLevel - 1) * 4;
  }

  private pondFishCount() {
    return this.pondFish.small + this.pondFish.mid + this.pondFish.deep;
  }

  private pondUpgradeCost() {
    return 40 + (this.pondLevel - 1) * 25;
  }

  private refreshHud() {
    this.inventoryText.setText(`垃圾: ${Math.floor(this.collectedTrash)}`);
    this.goldText.setText(`金币: ${this.gold}`);
    this.diveText.setText(
      `氧气 ${Math.ceil(this.oxygen)}/${this.maxOxygen()}\n压强 ${this.pressureLevel}级  潜水服 Lv.${this.suitLevel}`,
    );
    this.fishHotbar.update(this.caughtFish);
    const visibleFurnaceProgress = this.boatLevel >= MAX_BOAT_LEVEL ? 1 : this.furnaceProgress;
    this.furnaceBar.width = 170 * visibleFurnaceProgress;
    this.purifyBar.width = 170 * this.purification();
    this.shopButtons[3]?.text.setText(`鱼塘 +1  $${this.pondUpgradeCost()}`);
  }

  private spawnSpark(x: number, y: number, color: number) {
    const particle = this.add.circle(x, y, Phaser.Math.Between(3, 7), color, 0.85).setDepth(30);
    this.tweens.add({
      targets: particle,
      x: x + Phaser.Math.Between(-22, 22),
      y: y + Phaser.Math.Between(-28, 8),
      alpha: 0,
      scale: 0.2,
      duration: 420,
      onComplete: () => particle.destroy(),
    });
  }

  private spawnSplash(x: number, y: number, amount: number) {
    for (let i = 0; i < amount; i += 1) {
      const particle = this.add.circle(x, y, Phaser.Math.Between(2, 5), 0xbef7ff, 0.72).setDepth(31);
      this.tweens.add({
        targets: particle,
        x: x + Phaser.Math.Between(-36, 36),
        y: y + Phaser.Math.Between(-34, 18),
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(280, 520),
        onComplete: () => particle.destroy(),
      });
    }
  }

  private flashText(message: string) {
    const text = this.add.text(GAME_WIDTH / 2, 96, message, {
      fontFamily: "Arial, sans-serif",
      fontSize: "22px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: "rgba(5, 17, 31, 0.55)",
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(90);

    this.tweens.add({
      targets: text,
      y: 76,
      alpha: 0,
      duration: 1200,
      onComplete: () => text.destroy(),
    });
  }
}
