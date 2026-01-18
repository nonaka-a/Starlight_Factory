/**
 * --- Sky Manager: 夜空とキャンバスの管理 (Randomized V2) ---
 */
const SkyManager = {
    // 設定
    worldWidth: 2000,
    worldHeight: 1200,
    gridSize: 32,

    // 内部変数
    canvas: null,      // オフスクリーンキャンバス（描画用）
    ctx: null,
    stampsImage: new Image(),
    isLoaded: false,

    // ほしを見るモード用
    isActive: false,
    camera: { x: 0, y: 0 },
    dragStart: { x: 0, y: 0 },
    isDragging: false,
    uiAlpha: 1.0,
    uiTimer: 0,

    init: function () {
        if (this.canvas) return;

        // 裏画面（オフスクリーンキャンバス）の作成
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.worldWidth;
        this.canvas.height = this.worldHeight;
        this.ctx = this.canvas.getContext('2d');

        // スタンプ画像のロード
        this.stampsImage.src = 'image/star_stamps.png';
        this.stampsImage.onload = () => {
            this.isLoaded = true;
            this.initBackground();
        };
    },

    // 最初の夜空の下地を作る
    initBackground: function () {
        const ctx = this.ctx;
        // 背景色（濃い紺色グラデーション）
        const grad = ctx.createLinearGradient(0, 0, 0, this.worldHeight);
        grad.addColorStop(0, '#050510');
        grad.addColorStop(1, '#101025');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);
    },

    /**
     * 指定した座標を中心に、ランダムで自然な星の集まりを描画する
     * @param {number} gridX - 中心のグリッドX座標
     * @param {number} gridY - 中心のグリッドY座標
     * @param {number} sizeLevel - 0:星玉(小), 1:5星玉(中), 2:10星玉(大)
     * @param {string} color - 色コード
     */
    drawCluster: function (gridX, gridY, sizeLevel, color) {
        if (!this.isLoaded) return;

        // 基本半径の設定
        let radius = 1;
        if (sizeLevel === 1) radius = 2; // 5星玉
        if (sizeLevel === 2) radius = 4; // 10星玉

        // --- ステップ1: 基本エリアの描画（ムラ付き） ---
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > radius + 0.5) continue;

                // 距離ベースの密度決定
                let densityIndex = 2; // 低 (Row 2)
                if (dist <= 1.0) densityIndex = 0; // 高 (Row 0)
                else if (dist <= radius * 0.6) densityIndex = 1; // 中 (Row 1)

                // ★ランダム化: 密度のダウングレード（高→中、中→低へ確率で落とす）
                if (densityIndex === 0 && Math.random() < 0.66) densityIndex = 1;
                else if (densityIndex === 1 && Math.random() < 0.66) densityIndex = 2;

                // ★ランダム化: 間引き（低密度は確率で描かない）
                if (densityIndex === 2 && Math.random() < 0.4) continue;
                if (densityIndex === 1 && Math.random() < 0.1) continue;

                // 描画実行
                this.drawStampAtGrid(gridX + dx, gridY + dy, densityIndex, color);

                // ★ランダム化: 重ね打ち（高密度になった場所は確率で2回描く）
                if (densityIndex === 0 && Math.random() < 0.5) {
                    this.drawStampAtGrid(gridX + dx, gridY + dy, densityIndex, color);
                }
            }
        }

        // --- ステップ2: いびつな拡張 (Spikes) ---
        // ランダムな2～3方向へ星をはみ出させる
        const spikeCount = 2 + Math.floor(Math.random() * 2); 
        for (let i = 0; i < spikeCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spikeLen = radius + 2 + Math.floor(Math.random() * 3); // 半径+2~4マス
            
            // 中心から指定方向へ線を伸ばし、はみ出た部分に星を置く
            for (let d = radius + 1; d <= spikeLen; d++) {
                const ox = Math.round(Math.cos(angle) * d);
                const oy = Math.round(Math.sin(angle) * d);
                
                // 飛び石のようにまばらに描く
                if (Math.random() < 0.6) {
                    // 基本は低密度、たまに中密度
                    const spikeDensity = (Math.random() < 0.2) ? 1 : 2;
                    this.drawStampAtGrid(gridX + ox, gridY + oy, spikeDensity, color);
                }
            }
        }

        // --- ステップ3: 飛び地 (Strays) ---
        // 離れた場所にポツンと星を置く
        const strayCount = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < strayCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = radius * (1.5 + Math.random() * 0.8); // 半径の1.5~2.3倍
            
            const sx = Math.round(Math.cos(angle) * dist);
            const sy = Math.round(Math.sin(angle) * dist);
            
            this.drawStampAtGrid(gridX + sx, gridY + sy, 2, color); // 低密度
        }
    },

    /**
     * 1マスの描画処理（位置ズレ・サイズ変化を含む）
     */
    drawStampAtGrid: function (gx, gy, densityIndex, color) {
        // グリッド座標をピクセル座標へ
        const px = gx * this.gridSize;
        const py = gy * this.gridSize;

        // 画面外チェック
        if (px < 0 || px >= this.worldWidth || py < 0 || py >= this.worldHeight) return;

        // ★ランダム化: 位置ズレ (Jitter) ±10px
        const jitterX = (Math.random() - 0.5) * 20;
        const jitterY = (Math.random() - 0.5) * 20;

        // ★ランダム化: サイズ変化 0.8 ~ 1.3倍
        const scale = 0.8 + Math.random() * 0.5;

        // ★ランダム化: スタンプ画像の選択 (0~9)
        const stampCol = Math.floor(Math.random() * 10);

        this.drawSingleStamp(
            this.ctx,
            px + jitterX,
            py + jitterY,
            densityIndex, // Row
            stampCol,     // Col
            color,
            scale
        );
    },

    drawSingleStamp: function (ctx, x, y, row, col, color, scale) {
        const sw = 32, sh = 32; // スタンプ1コマのサイズ
        const sx = col * sw;
        const sy = row * sh;

        ctx.save();
        // 中心を基準に移動・回転・拡大縮小
        ctx.translate(x + this.gridSize / 2, y + this.gridSize / 2);
        
        const angle = Math.floor(Math.random() * 4) * (Math.PI / 2); // 0, 90, 180, 270度
        ctx.rotate(angle);
        if (Math.random() < 0.5) ctx.scale(-scale, scale); // 左右反転 + サイズ適用
        else ctx.scale(scale, scale);

        // 加算合成 (Lighter) で描画
        ctx.globalCompositeOperation = 'lighter';

        // 1. 光彩（色）
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.globalAlpha = 1.0;

        // 2. スタンプ描画
        // 画像自体は白で作られている前提。
        // globalCompositeOperation='lighter' の状態で、shadowColor に色を設定して描画することで
        // 白い星がその色でぼんやり光るような効果を狙う。
        ctx.drawImage(this.stampsImage, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);

        ctx.restore();
    },

    // --- ほしを見るモード ---
    startGazing: function () {
        this.isActive = true;
        this.uiAlpha = 1.0;
        this.uiTimer = 0;

        const ui = document.getElementById('ui-container');
        if (ui) ui.style.display = 'none';

        // カメラ初期位置（中央）
        this.camera.x = (this.worldWidth - 1000) / 2;
        this.camera.y = (this.worldHeight - 600) / 2;

        if (typeof isGameRunning !== 'undefined') isGameRunning = false;
        if (typeof gameLoopId !== 'undefined' && gameLoopId) cancelAnimationFrame(gameLoopId);

        this.loop();
    },

    stopGazing: function () {
        this.isActive = false;

        const ui = document.getElementById('ui-container');
        if (ui) ui.style.display = 'block';

        // ゲーム復帰
        if (typeof resetGameFromCraft === 'function') {
            // 特に報酬はないので0
            resetGameFromCraft(0);
        }
    },

    loop: function () {
        if (!this.isActive) return;
        Input.update();
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    },

    update: function () {
        // UI操作（やめるボタン）
        // ドラッグスクロール
        if (Input.isJustPressed) {
            this.isDragging = true;
            this.dragStart.x = Input.x;
            this.dragStart.y = Input.y;
            this.uiTimer = 0; // 触ったらUI表示
            this.uiAlpha = 1.0;

            // 戻るボタン判定 (右下エリア)
            if (Input.x > 850 && Input.y > 500) {
                this.stopGazing();
                return;
            }
        }

        if (Input.isDown && this.isDragging) {
            const dx = Input.x - this.dragStart.x;
            const dy = Input.y - this.dragStart.y;

            this.camera.x -= dx;
            this.camera.y -= dy;

            this.dragStart.x = Input.x;
            this.dragStart.y = Input.y;

            // 範囲制限
            this.camera.x = Math.max(0, Math.min(this.worldWidth - 1000, this.camera.x));
            this.camera.y = Math.max(0, Math.min(this.worldHeight - 600, this.camera.y));
        } else {
            this.isDragging = false;
        }

        // UI自動フェードアウト
        this.uiTimer++;
        if (this.uiTimer > 180) {
            this.uiAlpha = Math.max(0, this.uiAlpha - 0.05);
        }
    },

    draw: function () {
        const ctx = canvas.getContext('2d'); // メインキャンバス

        // 1. 裏画面（夜空）をカメラ位置に応じて描画
        if (this.canvas) {
            ctx.drawImage(
                this.canvas,
                this.camera.x, this.camera.y, 1000, 600,
                0, 0, 1000, 600
            );
        } else {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, 1000, 600);
        }

        // 2. キャラクター（赤まいまい・ピンクまいまい）を合成
        this.drawCharacters(ctx);

        // 3. UI（戻るボタンなど）
        if (this.uiAlpha > 0) {
            ctx.globalAlpha = this.uiAlpha;

            // 戻るボタン
            ctx.fillStyle = '#ff6b6b';
            ctx.beginPath();
            ctx.roundRect(860, 520, 120, 60, 30);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = "bold 20px 'M PLUS Rounded 1c', sans-serif";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("もどる", 920, 550);

            // ガイド
            ctx.textAlign = 'left';
            ctx.fillStyle = '#fff';
            ctx.fillText("ドラッグで夜空を見渡せます", 20, 570);

            ctx.globalAlpha = 1.0;
        }
    },

    drawCharacters: function (ctx) {
        // 簡易描画：丘と背中
        ctx.fillStyle = '#1a237e'; // 暗い丘の色
        ctx.beginPath();
        ctx.ellipse(500, 700, 600, 200, 0, 0, Math.PI * 2);
        ctx.fill();

        // 赤まいまい・ピンクまいまい（シルエット風）
        // 左
        ctx.fillStyle = '#d32f2f'; // 赤
        ctx.beginPath();
        ctx.arc(450, 530, 25, 0, Math.PI * 2); // 頭
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(450, 560, 30, 40, 0, 0, Math.PI * 2); // 体
        ctx.fill();

        // 右
        ctx.fillStyle = '#f48fb1'; // ピンク
        ctx.beginPath();
        ctx.arc(520, 535, 23, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(520, 565, 28, 38, 0, 0, Math.PI * 2);
        ctx.fill();
    }
};