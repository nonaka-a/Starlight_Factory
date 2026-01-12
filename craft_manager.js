/**
 * --- ほしぞら工房 クラフト統合マネージャー ---
 */
const CraftManager = {
    isActive: false,
    loopId: null,
    ctx: null,

    // 現在の工程: 'select', 'pouring', 'mixing', 'molding', 'firing', 'polishing'
    state: 'select',

    camera: { x: 0, y: 0, targetX: 0 },

    // 共通データ
    craftAmount: 1,
    maxCraftAmount: 1,

    currentStar: {
        mixProgress: 0,
        moldScore: 0,
        bakeTemp: 0,
        bakeProgress: 0,
        bakeState: 'raw',
        color: '#FFA500',
        particles: []
    },

    // 共通UI
    ui: {
        btnNext: { x: 400, y: 450, w: 200, h: 60, visible: false, text: "つぎへ！" }
    },

    init: function () {
        if (typeof canvas !== 'undefined') {
            this.ctx = canvas.getContext('2d');
        }
        // 各モジュールの初期化があればここで呼ぶ
    },

    start: function (maxMaterials) {
        this.isActive = true;
        this.state = 'select';
        this.camera.x = 0;
        this.camera.targetX = 0;

        this.maxCraftAmount = Math.max(1, Math.floor(maxMaterials / 5));
        this.craftAmount = 1;

        this.currentStar = {
            mixProgress: 0,
            moldScore: 0,
            bakeTemp: 0,
            bakeProgress: 0,
            bakeState: 'raw',
            color: '#FFA500',
            particles: []
        };

        this.resetNextBtn();
        this.ui.btnNext.visible = false;

        const ui = document.getElementById('ui-container');
        if (ui) ui.style.display = 'none';

        // 最初の工程(Select)の初期化は Craft1 が担当するが、
        // Select自体はループ開始直後に処理される

        if (this.loopId) cancelAnimationFrame(this.loopId);
        this.loop();
    },

    stop: function () {
        this.isActive = false;
        if (this.loopId) cancelAnimationFrame(this.loopId);

        const ui = document.getElementById('ui-container');
        if (ui) ui.style.display = 'block';

        if (typeof resetGameFromCraft === 'function') {
            resetGameFromCraft(this.craftAmount);
        }
    },

    loop: function () {
        if (!this.isActive) return;
        Input.update();
        this.update();
        this.draw();
        this.loopId = requestAnimationFrame(() => this.loop());
    },

    update: function () {
        this.camera.x += (this.camera.targetX - this.camera.x) * 0.1;

        // 状態に応じて各モジュールのupdateを呼ぶ
        if (this.state === 'select') {
            if (CraftMixing && CraftMixing.updateSelect) CraftMixing.updateSelect();
        } else if (this.state === 'pouring') {
            if (CraftMixing && CraftMixing.updatePouring) CraftMixing.updatePouring();
        } else if (this.state === 'mixing') {
            if (CraftMixing && CraftMixing.updateMix) CraftMixing.updateMix();
        } else if (this.state === 'molding') {
            if (CraftMolding && CraftMolding.update) CraftMolding.update();
        } else if (this.state === 'firing') {
            if (CraftFiring && CraftFiring.update) CraftFiring.update();
        } else if (this.state === 'polishing') {
            if (CraftPolishing && CraftPolishing.update) CraftPolishing.update();
        }

        // 共通: 次へボタン
        if (this.ui.btnNext.visible) {
            if (this.checkBtn(this.ui.btnNext)) {
                this.goToNextState();
                AudioSys.playTone(800, 'sine', 0.1);
            }
        }
    },

    draw: function () {
        const ctx = this.ctx;
        const w = 1000;
        const h = 600;

        ctx.fillStyle = '#f5e6d3';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(-this.camera.x, 0);

        // 各工程の描画
        // モジュールが存在するかチェックしながら描画

        // Craft 1 (Select/Pour/Mix) - Offset 0
        if (typeof CraftMixing !== 'undefined') {
            this.drawTable(0, this.state === 'select' ? "" : "きじを まぜよう！");
            if (this.state === 'select') CraftMixing.drawSelect(0);
            else if (this.state === 'pouring' || this.state === 'mixing') CraftMixing.drawMixArea(0);
        }

        // Craft 2 (Mold) - Offset 1000
        if (typeof CraftMolding !== 'undefined') {
            this.drawTable(1000, "かたぬき タイミング！");
            CraftMolding.draw(1000);
        }

        // Craft 3 (Fire) - Offset 2000
        if (typeof CraftFiring !== 'undefined') {
            this.drawTable(2000, "かげんを みて焼こう！");
            CraftFiring.draw(2000);
        }

        // Craft 4 (Polish) - Offset 3000
        if (typeof CraftPolishing !== 'undefined') {
            this.drawTable(3000, "さいごの 仕上げ！");
            CraftPolishing.draw(3000);
        }

        ctx.restore();

        // UI (画面固定)
        if (this.ui.btnNext.visible) {
            this.drawBtn(this.ui.btnNext);
        }

        // 共通演出パーティクル
        this.drawCommonParticles();
    },

    // --- 状態遷移 ---
    goToNextState: function () {
        this.resetNextBtn();

        if (this.state === 'mixing') {
            this.state = 'molding';
            this.camera.targetX = 1000;
            if (CraftMolding) CraftMolding.init();
        } else if (this.state === 'molding') {
            this.state = 'firing';
            this.camera.targetX = 2000;
            if (CraftFiring) CraftFiring.init();
        } else if (this.state === 'firing') {
            this.state = 'polishing';
            this.camera.targetX = 3000;
            if (CraftPolishing) CraftPolishing.init();
        } else if (this.state === 'polishing') {
            this.stop();
        }
    },

    // --- 共通ヘルパー関数 ---
    resetNextBtn: function () {
        this.ui.btnNext.visible = false;
    },

    checkBtn: function (btn) {
        if (!btn.visible) return false;
        const mx = Input.x;
        const my = Input.y;
        if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
            if (Input.isJustPressed) return true;
        }
        return false;
    },

    hitTest: function (btn) {
        const mx = Input.x - this.camera.x;
        const my = Input.y;
        return (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h);
    },

    drawBtn: function (btn, color) {
        if (!btn.visible && btn.visible !== undefined) return;
        const ctx = this.ctx;

        ctx.fillStyle = color || '#ff6b6b';
        ctx.beginPath();
        ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 30);
        ctx.fill();

        // 本体色の少し暗い色を影として使用（あるいは共通の半透明黒）
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        // 影も本体と同じ角丸 30 で描画
        ctx.roundRect(btn.x, btn.y + 4, btn.w, btn.h, 30);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = "bold 20px 'M PLUS Rounded 1c', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2);
    },

    drawTriangleBtn: function (btn, isUp) {
        const ctx = this.ctx;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 10);
        ctx.fill();
        ctx.strokeStyle = '#ddd';
        ctx.stroke();

        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        const cx = btn.x + btn.w / 2;
        const cy = btn.y + btn.h / 2;
        const s = 10;
        if (isUp) {
            ctx.moveTo(cx, cy - s);
            ctx.lineTo(cx + s, cy + s);
            ctx.lineTo(cx - s, cy + s);
        } else {
            ctx.moveTo(cx, cy + s);
            ctx.lineTo(cx + s, cy - s);
            ctx.lineTo(cx - s, cy - s);
        }
        ctx.fill();
    },

    drawTable: function (offsetX, title) {
        if (!title) return;
        const ctx = this.ctx;
        ctx.fillStyle = '#d2b48c';
        ctx.fillRect(offsetX + 100, 200, 800, 350);
        ctx.fillStyle = '#c0a070';
        ctx.fillRect(offsetX + 100, 550, 800, 20);
        ctx.fillStyle = '#8b4513';
        ctx.font = "bold 32px 'M PLUS Rounded 1c', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText(title, offsetX + 500, 100);
    },

    drawProgressBar: function (x, y, current, max) {
        const ctx = this.ctx;
        const w = 400;
        const h = 20;
        ctx.fillStyle = '#ccc';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(x, y, w * (current / max), h);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(x, y, w, h);
    },

    addParticle: function (x, y, color, speed) {
        this.currentStar.particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * speed,
            vy: (Math.random() - 0.5) * speed,
            life: 30 + Math.random() * 20,
            color: color,
            r: Math.random() * 5 + 2
        });
    },

    drawCommonParticles: function () {
        if (this.state === 'select' || this.state === 'pouring' || this.state === 'mixing') return;

        const ctx = this.ctx;
        ctx.save();
        for (const p of this.currentStar.particles) {
            if (p.isIngredient) continue;
            const screenX = p.x - this.camera.x;
            ctx.globalAlpha = p.life / 50;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(screenX, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    drawStarShape: function (ctx, cx, cy, outerR, innerR) {
        let rot = Math.PI / 2 * 3;
        let step = Math.PI / 5;
        ctx.moveTo(cx, cy - outerR);
        for (let i = 0; i < 5; i++) {
            let x = cx + Math.cos(rot) * outerR;
            let y = cy + Math.sin(rot) * outerR;
            ctx.lineTo(x, y);
            rot += step;
            x = cx + Math.cos(rot) * innerR;
            y = cy + Math.sin(rot) * innerR;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerR);
    }
};