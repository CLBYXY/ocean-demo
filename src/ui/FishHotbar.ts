import Phaser from "phaser";
import { FISH_KINDS, FISH_META, type FishCounts, type FishKind } from "../gameTypes";

type Slot = {
  kind: FishKind;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  border: Phaser.GameObjects.Rectangle;
  hitArea: Phaser.GameObjects.Zone;
  icon: Phaser.GameObjects.Image;
  count: Phaser.GameObjects.Text;
};

export class FishHotbar {
  private readonly scene: Phaser.Scene;
  private readonly x: number;
  private readonly y: number;
  private readonly onSelect: (kind: FishKind) => void;
  private readonly slots: Slot[] = [];
  private readonly tooltip: Phaser.GameObjects.Container;
  private readonly tooltipBg: Phaser.GameObjects.Rectangle;
  private readonly tooltipText: Phaser.GameObjects.Text;
  private readonly selectedText: Phaser.GameObjects.Text;
  private selected: FishKind = "small";

  constructor(scene: Phaser.Scene, x: number, y: number, onSelect: (kind: FishKind) => void) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.onSelect = onSelect;
    this.createSlots();

    this.selectedText = scene.add
      .text(x, y - 46, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        color: "#dffbff",
        fontStyle: "bold",
        stroke: "#04131f",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(84);

    this.tooltipBg = scene.add
      .rectangle(0, 0, 170, 78, 0x071927, 0.94)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x79ddff, 0.75);
    this.tooltipText = scene.add.text(12, 10, "", {
      fontFamily: "Arial, sans-serif",
      fontSize: "13px",
      color: "#ffffff",
      lineSpacing: 4,
    });
    this.tooltip = scene.add
      .container(0, 0, [this.tooltipBg, this.tooltipText])
      .setScrollFactor(0)
      .setDepth(95)
      .setVisible(false);

    this.setSelected("small", false);
  }

  update(counts: FishCounts) {
    this.slots.forEach((slot) => {
      slot.count.setText(String(counts[slot.kind]));
      slot.icon.setAlpha(counts[slot.kind] > 0 ? 1 : 0.38);
    });
  }

  getSelected() {
    return this.selected;
  }

  setSelected(kind: FishKind, animate = true) {
    this.selected = kind;
    this.onSelect(kind);

    this.slots.forEach((slot) => {
      const selected = slot.kind === kind;
      slot.border.setStrokeStyle(selected ? 4 : 2, selected ? 0x8ff7ff : 0x2f6a83, selected ? 1 : 0.75);
      slot.bg.setFillStyle(selected ? 0x124563 : 0x071927, selected ? 0.92 : 0.78);
    });

    const meta = FISH_META[kind];
    this.selectedText.setText(`当前选中: ${meta.name}  售价 ${meta.price}金币`);

    if (animate) {
      const slot = this.slots.find((item) => item.kind === kind);
      if (slot) {
        this.scene.tweens.add({
          targets: slot.container,
          scale: 1.14,
          duration: 90,
          yoyo: true,
          ease: "Sine.easeOut",
        });
      }
    }
  }

  private createSlots() {
    const slotSize = 58;
    const gap = 8;
    const totalWidth = FISH_KINDS.length * slotSize + (FISH_KINDS.length - 1) * gap;
    const startX = this.x - totalWidth / 2 + slotSize / 2;

    FISH_KINDS.forEach((kind, index) => {
      const slotX = startX + index * (slotSize + gap);
      const bg = this.scene.add.rectangle(0, 0, slotSize, slotSize, 0x071927, 0.78);
      bg.setStrokeStyle(2, 0x2f6a83, 0.75);
      const border = this.scene.add.rectangle(0, 0, slotSize + 4, slotSize + 4, 0x000000, 0);
      border.setStrokeStyle(2, 0x2f6a83, 0.75);
      const icon = this.scene.add.image(0, -3, FISH_META[kind].texture).setScale(FISH_META[kind].scale);
      const count = this.scene.add
        .text(19, 16, "0", {
          fontFamily: "Arial, sans-serif",
          fontSize: "17px",
          color: "#ffffff",
          fontStyle: "bold",
          stroke: "#04131f",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 0.5);
      const hitArea = this.scene.add.zone(0, 0, slotSize, slotSize).setInteractive({ useHandCursor: true });

      const container = this.scene.add
        .container(slotX, this.y, [bg, icon, count, border, hitArea])
        .setScrollFactor(0)
        .setDepth(82)
        .setSize(slotSize, slotSize);

      hitArea.on("pointerdown", (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.setSelected(kind);
      });
      hitArea.on("pointerover", () => {
        this.scene.tweens.add({ targets: container, y: this.y - 5, duration: 100, ease: "Sine.easeOut" });
        this.showTooltip(kind, slotX - 74, this.y - 145);
      });
      hitArea.on("pointerout", () => {
        this.scene.tweens.add({ targets: container, y: this.y, duration: 100, ease: "Sine.easeOut" });
        this.tooltip.setVisible(false);
      });

      this.slots.push({ kind, container, bg, border, hitArea, icon, count });
    });
  }

  private showTooltip(kind: FishKind, x: number, y: number) {
    const meta = FISH_META[kind];
    this.tooltipText.setText(`${meta.name}\n售价: ${meta.price}金币\n${meta.description}`);
    this.tooltip.setPosition(x, y).setVisible(true).setAlpha(0);
    this.scene.tweens.add({
      targets: this.tooltip,
      alpha: 1,
      duration: 100,
    });
  }
}
