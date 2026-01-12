// カメラ設定
let CANVAS_WIDTH = 1000;
let CANVAS_HEIGHT = 600;
let ZOOM_LEVEL = 1.0;

let canvas, ctx;
let isGameRunning = false;
let camera = { x: 0, y: 0 };

const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowDown: false,
    Space: false,
    KeyB: false
};

// ★追加: ポインター入力管理
const Input = {
    x: 0,
    y: 0,
    isDown: false,
    isJustPressed: false, // そのフレームで押された瞬間だけtrue
    _pressedThisFrame: false, // 内部制御用

    // フレームの頭で呼ぶ
    update: function() {
        this.isJustPressed = this._pressedThisFrame;
        this._pressedThisFrame = false;
    },
    
    // 座標計算用ヘルパー
    updatePosition: function(clientX, clientY) {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_WIDTH / rect.width;
        const scaleY = CANVAS_HEIGHT / rect.height;
        this.x = (clientX - rect.left) * scaleX;
        this.y = (clientY - rect.top) * scaleY;
    }
};

// --- 入力処理 ---
function setupControls() {
    window.addEventListener('keydown', (e) => {
        // BGM再生トリガー
        AudioSys.init();
        if (typeof AudioSys.playBGM === 'function' && !AudioSys.bgmSource && !AudioSys.isMuted) {
            const bgmName = (typeof isAtelierMode !== 'undefined' && isAtelierMode) ? 'atelier' : 'forest';
            AudioSys.playBGM(bgmName, 0.3);
        }

        if (e.code === 'Space') keys.Space = true;
        if (e.code === 'ArrowLeft') keys.ArrowLeft = true;
        if (e.code === 'ArrowRight') keys.ArrowRight = true;
        if (e.code === 'ArrowDown') keys.ArrowDown = true;
        if (e.code === 'KeyB' || e.code === 'KeyZ') keys.KeyB = true;
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') keys.Space = false;
        if (e.code === 'ArrowLeft') keys.ArrowLeft = false;
        if (e.code === 'ArrowRight') keys.ArrowRight = false;
        if (e.code === 'ArrowDown') keys.ArrowDown = false;
        if (e.code === 'KeyB' || e.code === 'KeyZ') keys.KeyB = false;
    });

    // --- ★追加: マウス/タッチ入力 (全体) ---
    const onPointerDown = (e) => {
        if (!canvas) return;
        Input.isDown = true;
        Input._pressedThisFrame = true;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        Input.updatePosition(clientX, clientY);
        
        if (typeof AudioSys !== 'undefined') AudioSys.init();
    };

    const onPointerMove = (e) => {
        if (!canvas) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        Input.updatePosition(clientX, clientY);
        
        // タッチ操作時のスクロール防止
        if(e.cancelable && e.target === canvas) e.preventDefault();
    };

    const onPointerUp = () => {
        Input.isDown = false;
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    // スマホ用
    setTimeout(() => {
        if(canvas) {
            canvas.addEventListener('touchstart', onPointerDown, { passive: false });
            canvas.addEventListener('touchmove', onPointerMove, { passive: false });
            canvas.addEventListener('touchend', onPointerUp);
        }
    }, 500);

    setupTouchControls();
}

function setupTouchControls() {
    const bindTouch = (id, code) => {
        const btn = document.getElementById(id);
        if (!btn) return;

        const down = (e) => {
            if (e.cancelable) e.preventDefault();
            AudioSys.init();
            if (typeof AudioSys.playBGM === 'function' && !AudioSys.bgmSource && !AudioSys.isMuted) {
                const bgmName = (typeof isAtelierMode !== 'undefined' && isAtelierMode) ? 'atelier' : 'forest';
                AudioSys.playBGM(bgmName, 0.3);
            }
            keys[code] = true;
            btn.classList.add('active');
        };

        const up = (e) => {
            if (e.cancelable) e.preventDefault();
            keys[code] = false;
            btn.classList.remove('active');
        };

        btn.addEventListener('touchstart', down, { passive: false });
        btn.addEventListener('touchend', up);
        btn.addEventListener('mousedown', down);
        btn.addEventListener('mouseup', up);
        btn.addEventListener('mouseleave', up);
    };

    bindTouch('btn-left', 'ArrowLeft');
    bindTouch('btn-right', 'ArrowRight');
    bindTouch('btn-down', 'ArrowDown');
    bindTouch('btn-jump', 'Space');
    bindTouch('btn-attack', 'KeyB');


    document.getElementById('btn-fullscreen')?.addEventListener('click', toggleFullScreen);
    document.getElementById('btn-mute')?.addEventListener('click', toggleMute);
}

function changeZoom(delta) {
    ZOOM_LEVEL = Math.max(0.5, Math.min(3.0, ZOOM_LEVEL + delta));
    if(typeof updateCamera === 'function') updateCamera();
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
}

function toggleMute() {
    AudioSys.isMuted = !AudioSys.isMuted;
    if (AudioSys.ctx) {
        if (AudioSys.isMuted) {
            AudioSys.ctx.suspend();
        } else {
            AudioSys.ctx.resume();
            if (typeof AudioSys.playBGM === 'function' && !AudioSys.bgmSource) {
                const bgmName = (typeof isAtelierMode !== 'undefined' && isAtelierMode) ? 'atelier' : 'forest';
                AudioSys.playBGM(bgmName, 0.3);
            }
        }
    }
    const btn = document.getElementById('btn-mute');
    if (btn) btn.textContent = AudioSys.isMuted ? "🔇" : "🔊";
}

function fitWindow() {
    const wrapper = document.getElementById('main-wrapper');
    const totalHeight = CANVAS_HEIGHT;
    const totalWidth = CANVAS_WIDTH;

    const scaleX = window.innerWidth / totalWidth;
    const scaleY = window.innerHeight / totalHeight;
    const scale = Math.min(scaleX, scaleY);

    wrapper.style.transform = `scale(${scale})`;
}

// --- 衝突判定ユーティリティ ---
function checkRectCollision(r1, r2) {
    return r1.x < r2.x + r2.width &&
        r1.x + r1.width > r2.x &&
        r1.y < r2.y + r2.height &&
        r1.y + r1.height > r2.y;
}