/**
 * イベント再生テスト
 */

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const info = document.getElementById('info');

let projectData = null;
let activeComp = null;
let startTime = 0;
let isLoaded = false;

// イージング関数
const easingFunctions = {
    'Linear': (t) => t,
    'EaseInOut': (t) => 0.5 * (1 - Math.cos(t * Math.PI))
};

// JSON読み込み
async function load() {
    try {
        const response = await fetch('../json/Main Comp.json');
        projectData = await response.json();

        // アクティブなコンポジションを探す
        const compId = projectData.activeCompId;
        activeComp = findAssetById(compId, projectData.assets);

        if (!activeComp) {
            // 見つからない場合は最初に見つかったコンポジションにする
            activeComp = findCompRecursive(projectData.assets);
        }

        if (!activeComp) throw new Error("Composition not found in JSON");

        // キャンバスサイズ設定
        canvas.width = activeComp.width || 1000;
        canvas.height = activeComp.height || 600;

        // アセット(画像)の読み込み
        await loadAllImages(activeComp.layers);

        info.textContent = `Playing: ${activeComp.name}`;
        isLoaded = true;
        startTime = performance.now();
        requestAnimationFrame(update);
    } catch (err) {
        console.error(err);
        info.textContent = "Error: " + err.message;
    }
}

// 再帰的にコンポジションを探す
function findCompRecursive(items) {
    for (const item of items) {
        if (item.type === 'comp') return item;
        if (item.type === 'folder' && item.children) {
            const found = findCompRecursive(item.children);
            if (found) return found;
        }
    }
    return null;
}

// IDからアセットを探す
function findAssetById(id, list) {
    for (const item of list) {
        if (item.id === id) return item;
        if (item.type === 'folder' && item.children) {
            const found = findAssetById(id, item.children);
            if (found) return found;
        }
    }
    return null;
}

// 全ての画像を読み込む
async function loadAllImages(layers) {
    const promises = [];
    for (const layer of layers) {
        if (layer.source) {
            promises.push(new Promise((resolve) => {
                const img = new Image();
                img.src = layer.source;
                img.onload = () => {
                    layer.imgObj = img;
                    resolve();
                };
                img.onerror = () => {
                    console.error("Failed to load image:", layer.source);
                    resolve(); // エラーでも続行
                };
            }));
        }
    }
    await Promise.all(promises);
}

// 補完値の取得
function getInterpolatedValue(layer, propName, time) {
    const track = layer.tracks[propName];
    if (!track || !track.keys || track.keys.length === 0) {
        // デフォルト値
        if (propName === 'position') return { x: canvas.width / 2, y: canvas.height / 2 };
        if (propName === 'scale') return 100;
        if (propName === 'rotation') return 0;
        if (propName === 'opacity') return 100;
        if (propName === 'motion') return layer.animId || "idle";
        return 0;
    }

    const keys = track.keys;
    // 時間でソート
    const sortedKeys = [...keys].sort((a, b) => a.time - b.time);

    // 範囲外
    if (time <= sortedKeys[0].time) return sortedKeys[0].value;
    if (time >= sortedKeys[sortedKeys.length - 1].time) return sortedKeys[sortedKeys.length - 1].value;

    // キーフレーム間を探す
    for (let i = 0; i < sortedKeys.length - 1; i++) {
        const k1 = sortedKeys[i];
        const k2 = sortedKeys[i + 1];
        if (time >= k1.time && time < k2.time) {
            // 文字列 (Motion等) は補間せずホールド
            if (typeof k1.value === 'string') {
                return k1.value;
            }

            const t = (time - k1.time) / (k2.time - k1.time);
            const easing = k1.easing || 'Linear';
            const relaxedT = (easingFunctions[easing] || easingFunctions.Linear)(t);

            if (typeof k1.value === 'object' && k1.value.x !== undefined) {
                // Vector2
                return {
                    x: k1.value.x + (k2.value.x - k1.value.x) * relaxedT,
                    y: k1.value.y + (k2.value.y - k1.value.y) * relaxedT
                };
            } else {
                // Number
                return k1.value + (k2.value - k1.value) * relaxedT;
            }
        }
    }
    return sortedKeys[sortedKeys.length - 1].value;
}

// レイヤーのTransform適用(再帰)
function applyTransform(layer, layers, time) {
    if (layer.parent) {
        const parent = layers.find(l => l.id === layer.parent);
        if (parent) {
            applyTransform(parent, layers, time);
        }
    }

    const pos = getInterpolatedValue(layer, "position", time);
    const scale = getInterpolatedValue(layer, "scale", time);
    const rot = getInterpolatedValue(layer, "rotation", time);

    ctx.translate(pos.x, pos.y);
    ctx.rotate(rot * Math.PI / 180);
    const s = scale / 100;
    ctx.scale(s, s);
}

// メインループ
function update(now) {
    if (!isLoaded) return;

    const elapsed = (now - startTime) / 1000;
    const duration = activeComp.duration || 10;
    const time = elapsed % duration; // ループ再生

    // 背景クリア
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // レイヤー描画
    const layers = activeComp.layers;
    for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];

        // 表示期間チェック
        if (time < (layer.inPoint || 0) || time > (layer.outPoint || duration)) continue;

        ctx.save();

        // 不透明度
        const opacity = getInterpolatedValue(layer, "opacity", time);
        ctx.globalAlpha = opacity / 100;

        // 変形適用
        applyTransform(layer, layers, time);

        if (layer.type === 'animated_layer') {
            // アニメーション表示
            const asset = findAssetById(layer.animAssetId, projectData.assets);
            const animId = getInterpolatedValue(layer, "motion", time);

            if (asset && asset.data && asset.data[animId]) {
                const anim = asset.data[animId];
                const localTime = time - (layer.startTime || 0);
                if (localTime >= 0 && anim.frames.length > 0) {
                    const frameIdx = Math.floor(localTime * anim.fps);
                    const actualIdx = layer.loop ? (frameIdx % anim.frames.length) : Math.min(frameIdx, anim.frames.length - 1);
                    const frame = anim.frames[actualIdx];
                    if (frame && layer.imgObj) {
                        ctx.drawImage(layer.imgObj, frame.x, frame.y, frame.w, frame.h, -frame.w / 2, -frame.h / 2, frame.w, frame.h);
                    }
                }
            }
        } else if (layer.imgObj) {
            // 通常画像描画(中心基準)
            ctx.drawImage(layer.imgObj, -layer.imgObj.width / 2, -layer.imgObj.height / 2);
        }

        ctx.restore();
    }

    requestAnimationFrame(update);
}

load();
