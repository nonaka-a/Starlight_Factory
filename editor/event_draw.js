/**
 * イベントエディタ: 描画関連
 * Step 16 (Fix): UI位置調整、Vector2個別操作対応、スケール連動UI
 */

// UI定数のオーバーライド (Vector2の値を表示する幅と位置を調整)
// 元のUI_LAYOUT = { TRASH_RIGHT: 30, PICK_RIGHT: 55, PARENT_RIGHT: 145, KEY_ADD_RIGHT: 30, VAL_SINGLE_RIGHT: 120, VAL_SINGLE_WIDTH: 80, VAL_VEC_Y_RIGHT: 100, VAL_VEC_X_RIGHT: 170, VAL_VEC_WIDTH: 60 };
// X値の右端を左にずらし(175)、間にスペースを作る
Object.assign(UI_LAYOUT, {
    VAL_VEC_X_RIGHT: 175, // 185 -> 175 (さらに右に寄せた)
    VAL_VEC_Y_RIGHT: 100
});

// 値フォーマット
function event_formatValue(val, type) {
    if (type === 'rotation') {
        const rev = Math.floor(val / 360);
        const deg = Math.floor(val % 360);
        return `${rev}x ${deg}°`;
    }
    if (type === 'string') return val;
    return val.toFixed(1);
}

// プレビューズーム計算
window.event_calcPreviewScale = function () {
    if (event_previewZoomMode === 'fit') {
        const container = document.getElementById('event-preview-container');
        if (!container) return;
        const cw = container.clientWidth - 20;
        const ch = container.clientHeight - 40;
        const compW = event_data.composition.width;
        const compH = event_data.composition.height;
        const scaleW = cw / compW;
        const scaleH = ch / compH;
        event_previewScale = Math.min(scaleW, scaleH);
    } else {
        event_previewScale = event_previewZoomMode;
    }
};

window.event_updatePreviewZoomUI = function () {
    const sel = document.getElementById('event-preview-zoom-mode');
    const slider = document.getElementById('event-preview-zoom-slider');
    const text = document.getElementById('event-preview-zoom-text');

    if (sel.value === 'fit') {
        event_previewZoomMode = 'fit';
        slider.disabled = true;
        text.textContent = 'Fit';
    } else {
        event_previewZoomMode = parseFloat(sel.value);
        slider.disabled = false;
        slider.value = event_previewZoomMode * 100;
        text.textContent = Math.round(event_previewZoomMode * 100) + '%';
    }
    event_draw();
};

window.event_onPreviewZoomSlider = function () {
    const slider = document.getElementById('event-preview-zoom-slider');
    const text = document.getElementById('event-preview-zoom-text');
    const sel = document.getElementById('event-preview-zoom-mode');

    const val = parseInt(slider.value);
    event_previewZoomMode = val / 100;

    sel.value = event_previewZoomMode.toString();
    text.textContent = val + '%';
    event_draw();
};

// --- 親子関係の再帰的Transform適用 ---
function event_applyLayerTransform(ctx, layerIdx, time) {
    const layer = event_data.layers[layerIdx];

    if (layer.parent) {
        const parentIdx = event_data.layers.findIndex(l => l.id === layer.parent);
        if (parentIdx !== -1) {
            event_applyLayerTransform(ctx, parentIdx, time);
        }
    }

    const pos = event_getInterpolatedValue(layerIdx, "position", time);
    const lScale = event_getInterpolatedValue(layerIdx, "scale", time);
    const rot = event_getInterpolatedValue(layerIdx, "rotation", time);

    ctx.translate(pos.x, pos.y);
    ctx.rotate(rot * Math.PI / 180);
    
    // スケール値の正負によって反転を表現
    const sx = lScale.x / 100;
    const sy = lScale.y / 100;
    ctx.scale(sx, sy);
}

// --- 描画メイン ---
window.event_draw = function () {
    if (!event_canvasTimeline || !event_canvasPreview) return;

    const zoomInput = document.getElementById('event-zoom');
    if (zoomInput) {
        event_pixelsPerSec = parseInt(zoomInput.value);
    }

    const drawTime = event_snapTime(event_currentTime);

    // --- Timeline Canvas リサイズ ---
    const containerW = event_timelineContainer.clientWidth;
    let totalTracks = 0;
    event_data.layers.forEach(l => {
        totalTracks++;
        if (l.expanded) totalTracks += Object.keys(l.tracks).length;
    });
    const requiredHeight = Math.max(event_timelineContainer.clientHeight, EVENT_HEADER_HEIGHT + totalTracks * EVENT_TRACK_HEIGHT + 50);

    if (event_canvasTimeline.width !== containerW || event_canvasTimeline.height !== requiredHeight) {
        event_canvasTimeline.width = containerW;
        event_canvasTimeline.height = requiredHeight;
    }

    const ctx = event_ctxTimeline;
    const w = event_canvasTimeline.width;
    const h = event_canvasTimeline.height;

    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, w, h);

    // --- プレビュー描画 ---
    event_calcPreviewScale();
    const scale = event_previewScale;

    const pW = event_data.composition.width * scale;
    const pH = event_data.composition.height * scale;
    if (event_canvasPreview.width !== pW || event_canvasPreview.height !== pH) {
        event_canvasPreview.width = pW;
        event_canvasPreview.height = pH;
    }

    event_ctxPreview.fillStyle = '#000';
    event_ctxPreview.fillRect(0, 0, pW, pH);

    event_ctxPreview.save();
    event_ctxPreview.scale(scale, scale);

    // コンポジション枠
    event_ctxPreview.strokeStyle = '#333';
    event_ctxPreview.lineWidth = 1;
    event_ctxPreview.beginPath();
    event_ctxPreview.moveTo(event_data.composition.width / 2, 0);
    event_ctxPreview.lineTo(event_data.composition.width / 2, event_data.composition.height);
    event_ctxPreview.moveTo(0, event_data.composition.height / 2);
    event_ctxPreview.lineTo(event_data.composition.width, event_data.composition.height / 2);
    event_ctxPreview.stroke();

    // レイヤー描画
    for (let i = event_data.layers.length - 1; i >= 0; i--) {
        const idx = i;
        const layer = event_data.layers[idx];
        if (drawTime < layer.inPoint || drawTime > layer.outPoint) continue;

        event_ctxPreview.save();
        event_applyLayerTransform(event_ctxPreview, idx, drawTime);

        const opacity = event_getInterpolatedValue(idx, "opacity", drawTime);
        event_ctxPreview.globalAlpha = opacity / 100;

        if (layer.type === 'animated_layer') {
            const asset = event_findAssetById(layer.animAssetId);
            const currentAnimId = event_getInterpolatedValue(idx, "motion", drawTime);
            if (asset && asset.data[currentAnimId]) {
                const anim = asset.data[currentAnimId];
                const elapsed = drawTime - layer.startTime;
                if (elapsed >= 0 && anim.frames.length > 0) {
                    const frameIdx = Math.floor(elapsed * anim.fps);
                    const actualIdx = layer.loop ? (frameIdx % anim.frames.length) : Math.min(frameIdx, anim.frames.length - 1);
                    const frame = anim.frames[actualIdx];
                    if (frame) {
                        event_ctxPreview.drawImage(layer.imgObj, frame.x, frame.y, frame.w, frame.h, -frame.w / 2, -frame.h / 2, frame.w, frame.h);
                        // 選択枠
                        if (event_selectedLayerIndex === idx) {
                            const currentTransform = event_ctxPreview.getTransform();
                            const pixelRatio = 1 / Math.sqrt(currentTransform.a * currentTransform.a + currentTransform.b * currentTransform.b);
                            event_ctxPreview.strokeStyle = '#0ff';
                            event_ctxPreview.lineWidth = 2 * pixelRatio;
                            event_ctxPreview.strokeRect(-frame.w / 2, -frame.h / 2, frame.w, frame.h);
                        }
                    }
                }
            }
        } else if (layer.imgObj && layer.imgObj.complete && layer.imgObj.naturalWidth > 0) {
            const iw = layer.imgObj.naturalWidth;
            const ih = layer.imgObj.naturalHeight;
            event_ctxPreview.drawImage(layer.imgObj, -iw / 2, -ih / 2);

            if (event_selectedLayerIndex === idx) {
                const currentTransform = event_ctxPreview.getTransform();
                const pixelRatio = 1 / Math.sqrt(currentTransform.a * currentTransform.a + currentTransform.b * currentTransform.b);
                event_ctxPreview.strokeStyle = '#0ff';
                event_ctxPreview.lineWidth = 2 * pixelRatio;
                event_ctxPreview.strokeRect(-iw / 2, -ih / 2, iw, ih);
            }
        } else {
            event_ctxPreview.fillStyle = '#48f';
            event_ctxPreview.fillRect(-32, -32, 64, 64);
        }
        event_ctxPreview.restore();
    }
    event_ctxPreview.restore();

    // --- タイムライン描画 ---

    // ヘッダー背景
    ctx.save();
    ctx.fillStyle = '#333';
    ctx.fillRect(EVENT_LEFT_PANEL_WIDTH, 0, w - EVENT_LEFT_PANEL_WIDTH, EVENT_HEADER_HEIGHT);
    ctx.strokeStyle = '#555';
    ctx.beginPath(); ctx.moveTo(0, EVENT_HEADER_HEIGHT); ctx.lineTo(w, EVENT_HEADER_HEIGHT); ctx.stroke();

    const viewEndTime = event_viewStartTime + ((w - EVENT_LEFT_PANEL_WIDTH) / event_pixelsPerSec);
    const secStep = event_pixelsPerSec > 100 ? 0.5 : 1.0;

    // 尺外の背景
    const compDurationX = EVENT_LEFT_PANEL_WIDTH + (event_data.composition.duration - event_viewStartTime) * event_pixelsPerSec;
    ctx.beginPath(); ctx.rect(EVENT_LEFT_PANEL_WIDTH, 0, w - EVENT_LEFT_PANEL_WIDTH, h); ctx.clip();

    ctx.fillStyle = '#111';
    ctx.fillRect(compDurationX, 0, w - compDurationX, h);

    // グリッド
    for (let t = Math.floor(event_viewStartTime); t <= viewEndTime; t += secStep) {
        if (t < 0) continue;
        if (t > event_data.composition.duration) break;

        const x = EVENT_LEFT_PANEL_WIDTH + (t - event_viewStartTime) * event_pixelsPerSec;
        ctx.strokeStyle = '#444'; ctx.beginPath(); ctx.moveTo(x, EVENT_HEADER_HEIGHT); ctx.lineTo(x, h); ctx.stroke();
        ctx.strokeStyle = '#888'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, EVENT_HEADER_HEIGHT); ctx.stroke();
        if (Math.floor(t) === t) {
            ctx.fillStyle = '#aaa';
            ctx.fillText(t + 's', x + 3, 14);
        }
    }

    // 尺終了ライン
    ctx.strokeStyle = '#666'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(compDurationX, 0); ctx.lineTo(compDurationX, h); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.restore();

    // トラック (上から順に描画)
    let currentY = EVENT_HEADER_HEIGHT;
    event_data.layers.forEach((layer, layerIdx) => {
        // レイヤー行
        ctx.fillStyle = (layerIdx === event_selectedLayerIndex) ? '#556' : '#3a3a3a';
        ctx.fillRect(0, currentY, w, EVENT_TRACK_HEIGHT);

        // 選択枠
        if (layerIdx === event_selectedLayerIndex) {
            ctx.strokeStyle = '#88a';
            ctx.lineWidth = 2;
            ctx.strokeRect(1, currentY + 1, EVENT_LEFT_PANEL_WIDTH - 2, EVENT_TRACK_HEIGHT - 2);
            ctx.lineWidth = 1;
        } else {
            ctx.strokeStyle = '#222';
            ctx.strokeRect(0, currentY, w, EVENT_TRACK_HEIGHT);
        }

        // 展開マーク
        ctx.fillStyle = '#aaa';
        ctx.font = '10px sans-serif';
        const expandMark = layer.expanded ? "▼" : "▶";
        ctx.fillText(expandMark, 5, currentY + 18);

        // サムネイル
        const iconSize = 20;
        const iconX = 25;
        const iconY = currentY + 5;
        if (layer.imgObj && layer.imgObj.complete) {
            try {
                const aspect = layer.imgObj.width / layer.imgObj.height;
                let dw = iconSize;
                let dh = iconSize;
                if (aspect > 1) dh = iconSize / aspect;
                else dw = iconSize * aspect;
                ctx.drawImage(layer.imgObj, iconX + (iconSize - dw) / 2, iconY + (iconSize - dh) / 2, dw, dh);
            } catch (e) {
                ctx.fillText("🖼️", iconX, currentY + 20);
            }
        } else {
            ctx.fillText("📄", iconX, currentY + 20);
        }

        // レイヤー名
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        const nameRightLimit = EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.PARENT_RIGHT - 10;
        const nameStart = iconX + iconSize + 5;
        const maxNameW = Math.max(10, nameRightLimit - nameStart);

        let dName = layer.name;
        if (ctx.measureText(dName).width > maxNameW) {
            while (ctx.measureText(dName + '...').width > maxNameW && dName.length > 0) dName = dName.slice(0, -1);
            dName += '...';
        }
        ctx.fillText(dName, nameStart, currentY + 20);

        // --- 親選択UI ---
        const pickWhipX = EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.PICK_RIGHT;
        const parentSelX = EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.PARENT_RIGHT;
        const parentSelW = UI_LAYOUT.PARENT_RIGHT - UI_LAYOUT.PICK_RIGHT - 5;

        // Pick Whip ◎
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pickWhipX + 8, currentY + EVENT_TRACK_HEIGHT / 2, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pickWhipX + 8, currentY + EVENT_TRACK_HEIGHT / 2, 2, 0, Math.PI * 2);
        ctx.fill();

        // 親プルダウン (擬似表示)
        ctx.fillStyle = '#222';
        ctx.fillRect(parentSelX, currentY + 4, parentSelW, EVENT_TRACK_HEIGHT - 8);
        ctx.fillStyle = '#ccc';
        ctx.font = '10px sans-serif';
        let parentName = "なし";
        if (layer.parent) {
            const p = event_data.layers.find(l => l.id === layer.parent);
            if (p) parentName = p.name;
            else parentName = "(不明)";
        }
        if (ctx.measureText(parentName).width > parentSelW - 15) {
            parentName = parentName.substring(0, 5) + '..';
        }
        ctx.fillText(parentName, parentSelX + 4, currentY + 18);
        ctx.fillStyle = '#666';
        ctx.fillText("▼", parentSelX + parentSelW - 12, currentY + 18);

        // ゴミ箱ボタン
        const trashX = EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.TRASH_RIGHT;
        const trashY = currentY + 5;
        ctx.fillStyle = '#d44';
        ctx.fillRect(trashX, trashY, 20, 20);
        ctx.fillStyle = '#fff';
        ctx.fillText("×", trashX + 6, trashY + 14);

        // レイヤーバー
        const inX = EVENT_LEFT_PANEL_WIDTH + (layer.inPoint - event_viewStartTime) * event_pixelsPerSec;
        const outX = EVENT_LEFT_PANEL_WIDTH + (layer.outPoint - event_viewStartTime) * event_pixelsPerSec;
        const barX = Math.max(EVENT_LEFT_PANEL_WIDTH, inX);
        const barW = Math.max(0, outX - barX);

        ctx.save();
        ctx.beginPath(); ctx.rect(EVENT_LEFT_PANEL_WIDTH, 0, w - EVENT_LEFT_PANEL_WIDTH, h); ctx.clip();
        if (barW > 0) {
            ctx.fillStyle = 'rgba(100, 150, 255, 0.3)';
            ctx.fillRect(barX, currentY + 4, barW, EVENT_TRACK_HEIGHT - 8);
            ctx.fillStyle = 'rgba(100, 150, 255, 0.8)';
            if (inX >= EVENT_LEFT_PANEL_WIDTH) ctx.fillRect(inX, currentY + 4, EVENT_LAYER_HANDLE_WIDTH, EVENT_TRACK_HEIGHT - 8);
            if (outX >= EVENT_LEFT_PANEL_WIDTH) ctx.fillRect(outX - EVENT_LAYER_HANDLE_WIDTH, currentY + 4, EVENT_LAYER_HANDLE_WIDTH, EVENT_TRACK_HEIGHT - 8);
        }
        ctx.restore();
        currentY += EVENT_TRACK_HEIGHT;

        // プロパティトラック
        if (layer.expanded) {
            Object.keys(layer.tracks).forEach(propName => {
                const track = layer.tracks[propName];
                ctx.fillStyle = '#2d2d2d'; ctx.fillRect(0, currentY, w, EVENT_TRACK_HEIGHT);
                ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.moveTo(0, currentY + EVENT_TRACK_HEIGHT); ctx.lineTo(w, currentY + EVENT_TRACK_HEIGHT); ctx.stroke();
                ctx.fillStyle = '#ddd'; ctx.font = '11px sans-serif'; ctx.fillText(track.label, 30, currentY + 19);

                const val = event_getInterpolatedValue(layerIdx, propName, drawTime);

                // --- 値表示 & ドラッグUI ---
                if (track.type === 'vector2') {
                    // Scale プロパティの場合のみチェックボックスを表示
                    if (propName === 'scale') {
                        const checkX = EVENT_LEFT_PANEL_WIDTH - 220;
                        ctx.font = '10px sans-serif';
                        
                        // X反転チェック (塗りつぶしでON状態を表現)
                        ctx.fillStyle = (val.x < 0) ? '#0ff' : '#444';
                        ctx.fillRect(checkX, currentY + 8, 12, 12);
                        ctx.strokeStyle = '#888';
                        ctx.strokeRect(checkX, currentY + 8, 12, 12);
                        ctx.fillStyle = '#aaa';
                        ctx.fillText("x", checkX + 15, currentY + 18);

                        // Y反転チェック
                        ctx.fillStyle = (val.y < 0) ? '#0ff' : '#444';
                        ctx.fillRect(checkX + 30, currentY + 8, 12, 12);
                        ctx.strokeStyle = '#888';
                        ctx.strokeRect(checkX + 30, currentY + 8, 12, 12);
                        ctx.fillStyle = '#aaa';
                        ctx.fillText("y", checkX + 45, currentY + 18);

                        // ★追加: リンクボタン (XとYの間)
                        // VAL_VEC_X_RIGHT: 175 -> X_END: L-115
                        // VAL_VEC_Y_RIGHT: 100 -> Y_START: L-100
                        // 隙間: L-115 ~ L-100 (15px)
                        const linkBtnX = EVENT_LEFT_PANEL_WIDTH - 113; // 隙間の中央
                        const linkBtnY = currentY + 8;
                        const linkBtnW = 10;
                        
                        ctx.fillStyle = '#444';
                        if (track.linked) ctx.fillStyle = '#666'; // ON時は少し明るく
                        ctx.fillRect(linkBtnX, linkBtnY, linkBtnW, 12);
                        ctx.strokeStyle = '#888';
                        ctx.strokeRect(linkBtnX, linkBtnY, linkBtnW, 12);
                        
                        // 鎖アイコンの代わりに「-」や「∞」っぽい記号
                        ctx.fillStyle = track.linked ? '#fff' : '#888';
                        ctx.fillText(track.linked ? "∞" : "-", linkBtnX + 1, currentY + 17);
                    }

                    // X値
                    const valX = EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.VAL_VEC_X_RIGHT;
                    ctx.fillStyle = '#3a2a2a'; // 赤っぽい背景
                    ctx.fillRect(valX, currentY + 4, UI_LAYOUT.VAL_VEC_WIDTH, EVENT_TRACK_HEIGHT - 8);
                    ctx.fillStyle = '#f88';
                    ctx.textAlign = 'right';
                    // UI上は絶対値を表示
                    ctx.fillText(Math.abs(val.x).toFixed(1), valX + UI_LAYOUT.VAL_VEC_WIDTH - 4, currentY + 19);

                    // Y値
                    const valY = EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.VAL_VEC_Y_RIGHT;
                    ctx.fillStyle = '#2a3a2a'; // 緑っぽい背景
                    ctx.fillRect(valY, currentY + 4, UI_LAYOUT.VAL_VEC_WIDTH, EVENT_TRACK_HEIGHT - 8);
                    ctx.fillStyle = '#8f8';
                    ctx.textAlign = 'right';
                    ctx.fillText(Math.abs(val.y).toFixed(1), valY + UI_LAYOUT.VAL_VEC_WIDTH - 4, currentY + 19);

                    ctx.textAlign = 'left';
                } else {
                    // Single Value
                    const valText = event_formatValue(val, track.type);
                    const valX = EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.VAL_SINGLE_RIGHT;
                    ctx.fillStyle = '#3a3a3a';
                    ctx.fillRect(valX, currentY + 4, UI_LAYOUT.VAL_SINGLE_WIDTH, EVENT_TRACK_HEIGHT - 8);
                    ctx.fillStyle = '#eee';
                    ctx.textAlign = 'right';
                    ctx.fillText(valText, valX + UI_LAYOUT.VAL_SINGLE_WIDTH - 4, currentY + 19);
                    ctx.textAlign = 'left';
                }

                // キーフレーム追加ボタン
                const btnX = EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.KEY_ADD_RIGHT;
                const btnY = currentY + EVENT_TRACK_HEIGHT / 2;
                ctx.strokeStyle = '#aaa'; ctx.beginPath(); ctx.moveTo(btnX, btnY - 5); ctx.lineTo(btnX + 5, btnY); ctx.lineTo(btnX, btnY + 5); ctx.lineTo(btnX - 5, btnY); ctx.closePath(); ctx.stroke();
                
                // 現在時刻にキーフレームがあるかチェック
                const hasKey = track.keys && track.keys.some(k => Math.abs(k.time - drawTime) < 0.001);
                if (hasKey) { ctx.fillStyle = '#48f'; ctx.fill(); }

                ctx.save();
                ctx.beginPath(); ctx.rect(EVENT_LEFT_PANEL_WIDTH, currentY, w - EVENT_LEFT_PANEL_WIDTH, EVENT_TRACK_HEIGHT); ctx.clip();
                if (track.keys) {
                    track.keys.forEach(key => {
                        const kx = EVENT_LEFT_PANEL_WIDTH + (key.time - event_viewStartTime) * event_pixelsPerSec;
                        const ky = currentY + EVENT_TRACK_HEIGHT / 2;
                        const isSelected = (event_selectedKey && event_selectedKey.keyObj === key);
                        const isDragging = (event_dragTarget && event_dragTarget.type === 'key' && event_dragTarget.obj === key);
                        
                        const isHold = (key.interpolation === 'Hold');
                        const isEase = (key.easeIn || key.easeOut);

                        if (isSelected || isDragging) { ctx.fillStyle = '#ff0'; ctx.strokeStyle = '#fff'; }
                        else { ctx.fillStyle = isHold ? '#f88' : '#ddd'; ctx.strokeStyle = '#000'; }

                        ctx.beginPath();
                        if (isHold) {
                            // 停止キーフレームは四角形
                            ctx.rect(kx - 4, ky - 4, 8, 8);
                        } else if (isEase) {
                            // イージングありは円形
                            ctx.arc(kx, ky, EVENT_KEYFRAME_SIZE, 0, Math.PI * 2);
                        } else {
                            // リニアはひし形
                            ctx.moveTo(kx, ky - EVENT_KEYFRAME_SIZE); 
                            ctx.lineTo(kx + EVENT_KEYFRAME_SIZE, ky); 
                            ctx.lineTo(kx, ky + EVENT_KEYFRAME_SIZE); 
                            ctx.lineTo(kx - EVENT_KEYFRAME_SIZE, ky); 
                            ctx.closePath();
                        }
                        ctx.fill(); ctx.stroke();
                    });
                }
                ctx.restore();
                currentY += EVENT_TRACK_HEIGHT;
            });
        }
    });

    const headX = EVENT_LEFT_PANEL_WIDTH + (drawTime - event_viewStartTime) * event_pixelsPerSec;
    if (headX >= EVENT_LEFT_PANEL_WIDTH && headX <= w) {
        ctx.strokeStyle = '#f00'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(headX, EVENT_HEADER_HEIGHT); ctx.lineTo(headX, h); ctx.stroke();
        ctx.fillStyle = '#f00';
        ctx.beginPath(); ctx.moveTo(headX, EVENT_HEADER_HEIGHT); ctx.lineTo(headX - 6, EVENT_HEADER_HEIGHT - 10); ctx.lineTo(headX + 6, EVENT_HEADER_HEIGHT - 10); ctx.fill();
    }

    // パネル蓋 & ヘッダー情報
    ctx.clearRect(0, 0, EVENT_LEFT_PANEL_WIDTH, EVENT_HEADER_HEIGHT);
    ctx.fillStyle = '#444'; ctx.fillRect(0, 0, EVENT_LEFT_PANEL_WIDTH, EVENT_HEADER_HEIGHT);
    ctx.strokeStyle = '#555'; ctx.strokeRect(0, 0, EVENT_LEFT_PANEL_WIDTH, EVENT_HEADER_HEIGHT);

    ctx.fillStyle = '#aaa'; ctx.font = '10px sans-serif';
    ctx.fillText("親", EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.PARENT_RIGHT + 5, 18);
    ctx.fillText("Link", EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.PICK_RIGHT - 10, 18);

    ctx.fillStyle = '#0ff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';

    const fps = event_data.composition.fps || 30;
    const sec = Math.floor(event_currentTime);
    const frame = Math.floor(((event_currentTime + 0.0001) % 1) * fps);
    const timeText = `${event_currentTime.toFixed(2)}s (${sec}s ${frame}f)`;
    ctx.fillText(timeText, 10, 20);

    if (event_state === 'drag-pickwhip' && event_pickWhipSourceLayerIdx !== -1 && window.event_currentMouseX !== undefined) {
        let srcY = EVENT_HEADER_HEIGHT;
        for (let i = 0; i < event_pickWhipSourceLayerIdx; i++) {
            srcY += EVENT_TRACK_HEIGHT;
            if (event_data.layers[i].expanded) srcY += Object.keys(event_data.layers[i].tracks).length * EVENT_TRACK_HEIGHT;
        }
        srcY += EVENT_TRACK_HEIGHT / 2;
        const srcX = EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.PICK_RIGHT + 8;

        const rect = event_canvasTimeline.getBoundingClientRect();
        const mouseX = window.event_currentMouseX - rect.left;
        const mouseY = window.event_currentMouseY - rect.top + event_timelineContainer.scrollTop;

        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(srcX, srcY);
        const cp1x = srcX + (mouseX - srcX) / 2;
        const cp2x = mouseX - (mouseX - srcX) / 2;
        ctx.bezierCurveTo(cp1x, srcY, cp2x, mouseY, mouseX, mouseY);
        ctx.stroke();
    }
};