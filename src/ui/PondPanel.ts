import Phaser from "phaser";
import { FISH_KINDS, FISH_META, type FishCounts, type FishKind } from "../gameTypes";

type PondFishVisual = {
  sprite: Phaser.GameObjects.Image;
  speed: number;
  minX: number;
  maxX: number;
};

export class PondPanel {
  private readonly scene: Phaser.Scene;
  private readonly pond: Phaser.GameObjects.Ellipse;
  private readonly label: Phaser.GameObjects.Text;
  private readonly panel: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly capacityText: Phaser.GameObjects.Text;
  private readonly fishText: Phaser.GameObjects.Text;
  private readonly visuals: PondFishVisual[] = [];
  private readonly bounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private open = false;
  private counts: FishCounts = { small: 0, mid: 0, deep: 0 };

  constructor(scene: Phaser.Scene, pond: Phaser.GameObjects.Ellipse) {
    this.scene = scene;
    this.pond = pond;
    this.label = scene.add
      .text(pond.x, pond.y - 40, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        color: "#d9fbff",
        fontStyle: "bold",
        stroke: "#03131f",
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(22);

    scene.tweens.add({
      targets: this.label,
      y: this.label.y - 5,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });

    this.panel = scene.add.container(0, 0).setScrollFactor(0).setDepth(90).setVisible(false);
    const bg = scene.add.rectangle(0, 0, 310, 240, 0x061723, 0.94).setOrigin(0, 0);
    bg.setStrokeStyle(2, 0x7deaff, 0.75);
    this.panel.add(bg);
    this.title = scene.add.text(18, 16, "鱼塘详情", this.textStyle(20, "#ffffff"));
    this.capacityText = scene.add.text(18, 50, "", this.textStyle(15, "#bff7ff"));
    this.fishText = scene.add.text(18, 82, "", this.textStyle(15, "#ffffff"));
    this.panel.add([this.title, this.capacityText, this.fishText]);

    this.createVisuals();
    this.hide();
  }

  update(counts: FishCounts, capacity: number, level: number) {
    this.counts = { ...counts };
    this.label.setText(`鱼塘 ${this.totalFish()}/${capacity}`);
    this.capacityText.setText(`等级 Lv.${level}    容量 ${this.totalFish()}/${capacity}`);
    this.fishText.setText(
      `小鱼: ${counts.small}\n中层鱼: ${counts.mid}\n深海鱼: ${counts.deep}`,
    );
    this.updateVisualVisibility();
  }

  updateWorldPosition(x: number, y: number) {
    this.label.setPosition(x, y - 44);
  }

  updateMotion(deltaSeconds: number) {
    this.label.setPosition(this.pond.x, this.pond.y - 44);

    if (!this.open) {
      return;
    }

    this.visuals.forEach((item) => {
      if (!item.sprite.visible) {
        return;
      }

      item.sprite.x += item.speed * deltaSeconds;
      item.sprite.y += Math.sin(this.scene.time.now * 0.004 + item.sprite.x * 0.08) * 0.12;

      if (item.sprite.x > item.maxX || item.sprite.x < item.minX) {
        item.speed *= -1;
        item.sprite.setScale(-item.sprite.scaleX, item.sprite.scaleY);
      }
    });
  }

  containsScreenPoint(x: number, y: number) {
    return this.open && this.bounds.contains(x, y);
  }

  show() {
    if (this.open) {
      return;
    }

    this.open = true;
    this.panel.setPosition(34, 250).setVisible(true).setAlpha(0).setScale(0.96);
    this.bounds.setTo(34, 250, 310, 240);
    this.scene.tweens.add({
      targets: this.panel,
      alpha: 1,
      scale: 1,
      duration: 180,
      ease: "Back.easeOut",
    });
    this.updateVisualVisibility();
  }

  hide() {
    if (!this.open) {
      this.panel.setVisible(false);
      return;
    }

    this.open = false;
    this.scene.tweens.add({
      targets: this.panel,
      alpha: 0,
      scale: 0.96,
      duration: 140,
      ease: "Sine.easeIn",
      onComplete: () => this.panel.setVisible(false),
    });
  }

  isOpen() {
    return this.open;
  }

  private createVisuals() {
    const startX = 64;
    const startY = 156;
    const specs: Array<{ kind: FishKind; count: number; speed: number }> = [
      { kind: "small", count: 5, speed: 34 },
      { kind: "mid", count: 4, speed: 24 },
      { kind: "deep", count: 3, speed: 14 },
    ];

    specs.forEach((spec, groupIndex) => {
      for (let i = 0; i < spec.count; i += 1) {
        const sprite = this.scene.add
          .image(startX + i * 42, startY + groupIndex * 22, FISH_META[spec.kind].texture)
          .setScale(FISH_META[spec.kind].scale * 0.78)
          .setVisible(false);
        this.panel.add(sprite);
        this.visuals.push({
          sprite,
          speed: spec.speed * (i % 2 === 0 ? 1 : -1),
          minX: 46,
          maxX: 268,
        });
      }
    });
  }

  private updateVisualVisibility() {
    const byKindUsed: FishCounts = { small: 0, mid: 0, deep: 0 };

    this.visuals.forEach((item) => {
      const kind = this.kindFromTexture(item.sprite.texture.key);
      const visible = Boolean(kind && byKindUsed[kind] < this.counts[kind]);
      item.sprite.setVisible(this.open && visible);
      if (kind && visible) {
        byKindUsed[kind] += 1;
      }
    });
  }

  private kindFromTexture(texture: string): FishKind | undefined {
    return FISH_KINDS.find((kind) => FISH_META[kind].texture === texture);
  }

  private totalFish() {
    return this.counts.small + this.counts.mid + this.counts.deep;
  }

  private textStyle(size: number, color: string) {
    return {
      fontFamily: "Arial, sans-serif",
      fontSize: `${size}px`,
      color,
      fontStyle: "bold",
    };
  }
}
