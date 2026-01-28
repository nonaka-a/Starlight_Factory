/**
 * イベントエディタ: 入力処理
 */

// --- マウスダウン処理 ---
window.event_onTimelineMouseDown = function(e) {
    const rect = event_canvasTimeline.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + event_timelineContainer.scrollTop;

    // ヘッダー判定
    if (y < EVENT_HEADER_HEIGHT && x > EVENT_LEFT_PANEL_WIDTH) {
        event_state = 'scrub-time';
        event_updateSeekFromMouse(x);
        return;
    }

    let currentY = EVENT_HEADER_HEIGHT;
    for (let i = 0; i < event_data.layers.length; i++) {
        const layer = event_data.layers[i];
        
        // レイヤー行
        if (y >= currentY && y < currentY + EVENT_TRACK_HEIGHT) {
            if (x < EVENT_LEFT_PANEL_WIDTH) {
                // 左パネル: レイヤー選択・開閉
                layer.expanded = !layer.expanded;
                event_selectedLayerIndex = i;
                event_selectedKey = null;
                event_draw();
            } else {
                // タイムライン: レイヤー移動・伸縮
                const inX = EVENT_LEFT_PANEL_WIDTH + (layer.inPoint - event_viewStartTime) * event_pixelsPerSec;
                const outX = EVENT_LEFT_PANEL_WIDTH + (layer.outPoint - event_viewStartTime) * event_pixelsPerSec;
                const hw = EVENT_LAYER_HANDLE_WIDTH;
                
                if (Math.abs(x - inX) <= hw) {
                    event_state = 'drag-layer-in';
                    event_selectedLayerIndex = i;
                    event_dragTarget = { layerIdx: i };
                    event_dragStartPos = { x: e.clientX, y: e.clientY };
                } else if (Math.abs(x - outX) <= hw) {
                    event_state = 'drag-layer-out';
                    event_selectedLayerIndex = i;
                    event_dragTarget = { layerIdx: i };
                    event_dragStartPos = { x: e.clientX, y: e.clientY };
                } else if (x > inX && x < outX) {
                    event_state = 'drag-layer-move';
                    event_selectedLayerIndex = i;
                    event_dragTarget = { layerIdx: i, startIn: layer.inPoint, startOut: layer.outPoint };
                    event_dragStartPos = { x: e.clientX, y: e.clientY };
                } else {
                    event_selectedLayerIndex = i;
                }
                event_draw();
            }
            return;
        }
        currentY += EVENT_TRACK_HEIGHT;

        // トラック行
        if (layer.expanded) {
            const props = Object.keys(layer.tracks);
            for (let j = 0; j < props.length; j++) {
                const prop = props[j];
                const track = layer.tracks[prop];

                if (y >= currentY && y < currentY + EVENT_TRACK_HEIGHT) {
                    if (x < EVENT_LEFT_PANEL_WIDTH) {
                        // 左パネル: 値編集・キー追加
                        const valRightX = EVENT_LEFT_PANEL_WIDTH - 40;
                        if (x > valRightX - EVENT_VALUE_CLICK_WIDTH && x < valRightX + 10) {
                            event_state = 'check-value-edit';
                            event_dragStartPos = { x: e.clientX, y: e.clientY };
                            const curVal = event_getInterpolatedValue(i, prop, event_currentTime);
                            event_dragTarget = { 
                                type: 'value', layerIdx: i, prop: prop, startVal: curVal, step: track.step, trackType: track.type,
                                originX: x, originY: y, min: track.min, max: track.max
                            };
                            return;
                        }
                        const btnX = EVENT_LEFT_PANEL_WIDTH - 20;
                        if (Math.abs(x - btnX) < 10) {
                            const val = event_getInterpolatedValue(i, prop, event_currentTime);
                            const newKey = event_updateKeyframe(i, prop, event_currentTime, val);
                            event_selectedKey = { layerIdx: i, prop: prop, keyObj: newKey };
                            event_draw();
                            return;
                        }
                    } else {
                        // タイムライン: キーフレーム選択
                        let hit = false;
                        for (let k = 0; k < track.keys.length; k++) {
                            const key = track.keys[k];
                            const kx = EVENT_LEFT_PANEL_WIDTH + (key.time - event_viewStartTime) * event_pixelsPerSec;
                            if (Math.abs(x - kx) <= EVENT_KEYFRAME_HIT_RADIUS) {
                                event_state = 'drag-key';
                                event_dragTarget = { type: 'key', obj: key, layerIdx: i, prop: prop };
                                event_selectedKey = { layerIdx: i, prop: prop, keyObj: key };
                                event_draw();
                                hit = true;
                                break;
                            }
                        }
                        if (hit) return;
                    }
                }
                currentY += EVENT_TRACK_HEIGHT;
            }
        }
    }

    // 空白クリック
    if (x > EVENT_LEFT_PANEL_WIDTH) {
        event_selectedKey = null;
        event_state = 'scrub-time';
        event_updateSeekFromMouse(x);
    }
};

// --- マウス移動処理 ---
window.event_onGlobalMouseMove = function(e) {
    if (!document.getElementById('mode-event').classList.contains('active')) return;
    
    // カーソル処理 (idle時)
    if (event_state === 'idle') {
        const rect = event_canvasTimeline.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top + event_timelineContainer.scrollTop;
        let cursor = 'default';
        if (x > EVENT_LEFT_PANEL_WIDTH && y > EVENT_HEADER_HEIGHT) {
            cursor = 'default';
            let currentY = EVENT_HEADER_HEIGHT;
            for (let i = 0; i < event_data.layers.length; i++) {
                const layer = event_data.layers[i];
                if (y >= currentY && y < currentY + EVENT_TRACK_HEIGHT) {
                    const inX = EVENT_LEFT_PANEL_WIDTH + (layer.inPoint - event_viewStartTime) * event_pixelsPerSec;
                    const outX = EVENT_LEFT_PANEL_WIDTH + (layer.outPoint - event_viewStartTime) * event_pixelsPerSec;
                    if (Math.abs(x - inX) <= EVENT_LAYER_HANDLE_WIDTH || Math.abs(x - outX) <= EVENT_LAYER_HANDLE_WIDTH) {
                        cursor = 'ew-resize';
                    } else if (x > inX && x < outX) {
                        cursor = 'move';
                    }
                }
                currentY += EVENT_TRACK_HEIGHT;
                if (layer.expanded) currentY += Object.keys(layer.tracks).length * EVENT_TRACK_HEIGHT;
            }
        }
        event_canvasTimeline.style.cursor = cursor;
        return;
    }

    // 各ステート処理
    if (event_state === 'resize-panel') {
        const workspace = document.getElementById('event-workspace');
        const workspaceRect = workspace.getBoundingClientRect();
        const relativeY = e.clientY - workspaceRect.top;
        const percentage = (relativeY / workspaceRect.height) * 100;
        if (percentage > 20 && percentage < 80) {
            event_previewContainer.style.height = `${percentage}%`;
            event_draw();
        }
    }
    else if (event_state === 'check-value-edit') {
        if (Math.abs(e.clientX - event_dragStartPos.x) > 3) event_state = 'scrub-value';
    }
    else if (event_state === 'scrub-value') {
        const delta = e.clientX - event_dragStartPos.x;
        const target = event_dragTarget;
        let newVal;
        if (target.trackType === 'vector2') {
            newVal = { ...target.startVal };
            newVal.x += delta * target.step;
        } else {
            newVal = target.startVal + delta * target.step;
            if (target.min !== undefined) newVal = Math.max(target.min, newVal);
            if (target.max !== undefined) newVal = Math.min(target.max, newVal);
        }
        event_updateKeyframe(target.layerIdx, target.prop, event_currentTime, newVal);
        event_draw();
    }
    else if (event_state === 'scrub-time') {
        const rect = event_canvasTimeline.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x > EVENT_LEFT_PANEL_WIDTH) {
            event_updateSeekFromMouse(x);
        }
    }
    else if (event_state === 'drag-key') {
        const rect = event_canvasTimeline.getBoundingClientRect();
        const x = e.clientX - rect.left;
        let time = event_viewStartTime + ((x - EVENT_LEFT_PANEL_WIDTH) / event_pixelsPerSec);
        time = event_snapTime(Math.max(0, time));
        event_dragTarget.obj.time = time;
        event_draw();
    }
    else if (event_state === 'drag-preview') {
        const rect = event_canvasPreview.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const dx = (mx - event_dragStartPos.x) / event_previewScale;
        const dy = (my - event_dragStartPos.y) / event_previewScale;
        const newX = event_dragTarget.startX + dx;
        const newY = event_dragTarget.startY + dy;
        event_updateKeyframe(event_dragTarget.layerIdx, "position", event_currentTime, {x: newX, y: newY});
        event_draw();
    }
    else if (event_state === 'drag-layer-in') {
        const rect = event_canvasTimeline.getBoundingClientRect();
        const x = e.clientX - rect.left;
        let time = event_viewStartTime + ((x - EVENT_LEFT_PANEL_WIDTH) / event_pixelsPerSec);
        time = event_snapTime(time);
        const layer = event_data.layers[event_dragTarget.layerIdx];
        layer.inPoint = Math.min(time, layer.outPoint);
        event_draw();
    }
    else if (event_state === 'drag-layer-out') {
        const rect = event_canvasTimeline.getBoundingClientRect();
        const x = e.clientX - rect.left;
        let time = event_viewStartTime + ((x - EVENT_LEFT_PANEL_WIDTH) / event_pixelsPerSec);
        time = event_snapTime(time);
        const layer = event_data.layers[event_dragTarget.layerIdx];
        layer.outPoint = Math.max(time, layer.inPoint);
        event_draw();
    }
    else if (event_state === 'drag-layer-move') {
        const deltaX = e.clientX - event_dragStartPos.x;
        const dt = deltaX / event_pixelsPerSec;
        const layer = event_data.layers[event_dragTarget.layerIdx];
        
        layer.inPoint += dt;
        layer.outPoint += dt;
        Object.values(layer.tracks).forEach(track => {
            track.keys.forEach(key => key.time += dt);
        });
        
        event_dragStartPos = { x: e.clientX, y: e.clientY };
        event_draw();
    }
};

// --- マウスアップ処理 ---
window.event_onGlobalMouseUp = function(e) {
    if (event_state === 'check-value-edit') {
        const target = event_dragTarget;
        let initStr = "";
        if (target.trackType === 'vector2') initStr = `${target.startVal.x},${target.startVal.y}`;
        else if (target.trackType === 'rotation') {
            const r = Math.floor(target.startVal/360);
            const d = Math.floor(target.startVal%360);
            initStr = `${r}+${d}`;
        } else {
            initStr = target.startVal.toString();
        }
        event_showInlineInput(target.originX - 40, target.originY, initStr, target.trackType, (newVal) => {
            event_updateKeyframe(target.layerIdx, target.prop, event_currentTime, newVal);
            event_draw();
        });
    }
    else if (event_state === 'drag-key') {
        const t = event_dragTarget;
        const layer = event_data.layers[t.layerIdx];
        layer.tracks[t.prop].keys.sort((a, b) => a.time - b.time);
        event_draw();
    }
    else if (event_state === 'drag-preview') {
        const layer = event_data.layers[event_dragTarget.layerIdx];
        const track = layer.tracks["position"];
        const key = track.keys.find(k => Math.abs(k.time - event_currentTime) < 0.001);
        if (key) {
            event_selectedKey = { layerIdx: event_dragTarget.layerIdx, prop: "position", keyObj: key };
            event_draw();
        }
    }
    else if (event_state === 'drag-layer-move') {
        // 終了時スナップ
        const layer = event_data.layers[event_dragTarget.layerIdx];
        const diff = event_snapTime(layer.inPoint) - layer.inPoint;
        layer.inPoint += diff;
        layer.outPoint += diff;
        Object.values(layer.tracks).forEach(track => {
            track.keys.forEach(key => key.time = event_snapTime(key.time));
        });
        event_draw();
    }
    
    event_state = 'idle';
    event_dragTarget = null;
};

// --- プレビュー操作 ---
window.event_onPreviewMouseDown = function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    const rect = event_canvasPreview.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const compMx = mx / event_previewScale;
    const compMy = my / event_previewScale;

    for (let i = event_data.layers.length - 1; i >= 0; i--) {
        const layer = event_data.layers[i];
        if (event_currentTime < layer.inPoint || event_currentTime > layer.outPoint) continue;
        if (!layer.imgObj) continue;

        const pos = event_getInterpolatedValue(i, "position", event_currentTime);
        const iw = layer.imgObj.naturalWidth || 64;
        const ih = layer.imgObj.naturalHeight || 64;
        
        if (compMx >= pos.x - iw/2 && compMx <= pos.x + iw/2 && compMy >= pos.y - ih/2 && compMy <= pos.y + ih/2) {
            event_selectedLayerIndex = i;
            event_state = 'drag-preview';
            event_dragStartPos = { x: mx, y: my };
            event_dragTarget = { layerIdx: i, startX: pos.x, startY: pos.y };
            event_draw();
            return;
        }
    }
    event_selectedLayerIndex = -1;
    event_draw();
};

// --- キー操作 ---
window.event_onKeyDown = function(e) {
    if (e.target.tagName === 'INPUT') return;
    const modeEvent = document.getElementById('mode-event');
    if (!modeEvent || !modeEvent.classList.contains('active')) return;

    if (e.code === 'Space') { e.preventDefault(); event_togglePlay(); }
    else if (e.code === 'KeyJ') { event_jumpToPrevKeyframe(); }
    else if (e.code === 'KeyK') { event_jumpToNextKeyframe(); }
    else if (e.code === 'Delete' || e.code === 'Backspace') { event_deleteSelectedKeyframe(); }
    
    if (e.altKey && event_selectedLayerIndex !== -1) {
        if (e.code === 'BracketLeft') {
            e.preventDefault();
            event_data.layers[event_selectedLayerIndex].inPoint = event_snapTime(event_currentTime);
            if (event_data.layers[event_selectedLayerIndex].inPoint > event_data.layers[event_selectedLayerIndex].outPoint) {
                event_data.layers[event_selectedLayerIndex].inPoint = event_data.layers[event_selectedLayerIndex].outPoint;
            }
            event_draw();
        } else if (e.code === 'BracketRight') {
            e.preventDefault();
            event_data.layers[event_selectedLayerIndex].outPoint = event_snapTime(event_currentTime);
            if (event_data.layers[event_selectedLayerIndex].outPoint < event_data.layers[event_selectedLayerIndex].inPoint) {
                event_data.layers[event_selectedLayerIndex].outPoint = event_data.layers[event_selectedLayerIndex].inPoint;
            }
            event_draw();
        }
    }
};

function event_updateSeekFromMouse(mouseX) {
    if (mouseX < EVENT_LEFT_PANEL_WIDTH) return;
    let time = event_viewStartTime + ((mouseX - EVENT_LEFT_PANEL_WIDTH) / event_pixelsPerSec);
    time = Math.max(0, Math.min(time, event_data.composition.duration));
    event_seekTo(event_snapTime(time));
}

// --- インライン入力表示 ---
function event_showInlineInput(x, y, initialValue, trackType, callback) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = initialValue;
    input.style.position = 'absolute';
    input.style.left = `${x}px`;
    input.style.top = `${y}px`;
    input.style.width = '80px';
    input.style.zIndex = '1000';
    const commit = () => {
        const valStr = input.value;
        let finalVal = null;
        if (trackType === 'vector2') {
            const parts = valStr.split(',');
            if (parts.length === 2) {
                const px = parseFloat(parts[0]);
                const py = parseFloat(parts[1]);
                if (!isNaN(px) && !isNaN(py)) finalVal = { x: px, y: py };
            }
        } else if (trackType === 'rotation') {
            if (valStr.includes('+')) {
                const parts = valStr.split('+');
                const rev = parseFloat(parts[0]);
                const deg = parseFloat(parts[1]);
                if (!isNaN(rev) && !isNaN(deg)) finalVal = rev * 360 + deg;
            } else {
                const f = parseFloat(valStr);
                if (!isNaN(f)) finalVal = f;
            }
        } else {
            const f = parseFloat(valStr);
            if (!isNaN(f)) finalVal = f;
        }
        if (finalVal !== null) callback(finalVal);
        if (input.parentNode) input.parentNode.removeChild(input);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
    input.addEventListener('blur', commit);
    event_timelineContainer.appendChild(input);
    input.focus();
}