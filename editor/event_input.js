/**
 * イベントエディタ: 入力処理
 * Step 16 (Fix): UI位置調整、Vector2個別操作対応
 */

// Pick Whip用ステート変数
let event_pickWhipSourceLayerIdx = -1;

// --- D&D受け入れ ---
window.event_onTimelineDragOver = function (e) {
    if (window.event_draggedAsset) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }
};

window.event_onTimelineDrop = function (e) {
    e.preventDefault();
    if (!window.event_draggedAsset) return;

    event_pushHistory(); // 履歴保存
    const item = window.event_draggedAsset;

    if (item.type === 'image') {
        event_addLayer(item.name, item.src);
    } else if (item.type === 'animation') {
        event_addAnimatedLayer(item.name, item.id);
    } else if (item.type === 'sub_animation') {
        event_addAnimatedLayer(item.name, item.parentAssetId, item.animId);
    } else if (item.type === 'comp') {
        console.log("Nested composition not supported yet.");
    }

    window.event_draggedAsset = null;
};

// --- ダブルクリック処理 (名前編集など) ---
window.event_onTimelineDblClick = function (e) {
    const rect = event_canvasTimeline.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + event_timelineContainer.scrollTop;

    // トラックエリア
    let currentY = EVENT_HEADER_HEIGHT;
    for (let i = 0; i < event_data.layers.length; i++) {
        const layer = event_data.layers[i];

        // レイヤー行
        if (y >= currentY && y < currentY + EVENT_TRACK_HEIGHT) {
            // レイヤー名エリア判定 (おおよそ x: 50 〜 EVENT_LEFT_PANEL_WIDTH - 100)
            const nameStart = 50;
            const nameEnd = EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.PARENT_RIGHT - 10;

            if (x >= nameStart && x <= nameEnd) {
                // 名前編集
                event_showInlineInput(x, currentY + 5, layer.name, 'string', (newName) => {
                    if (newName && newName.trim() !== "") {
                        event_pushHistory();
                        layer.name = newName;
                        event_draw();
                    }
                });
            }
            return;
        }
        currentY += EVENT_TRACK_HEIGHT;
        if (layer.expanded) {
            currentY += Object.keys(layer.tracks).length * EVENT_TRACK_HEIGHT;
        }
    }
};

// --- ユーティリティ ---
window.event_updateSeekFromMouse = function (x) {
    let time = event_viewStartTime + (x - EVENT_LEFT_PANEL_WIDTH) / event_pixelsPerSec;
    time = event_snapTime(Math.max(0, time));
    event_seekTo(time);
};

// --- マウスダウン処理 ---
window.event_onTimelineMouseDown = function (e) {
    const rect = event_canvasTimeline.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + event_timelineContainer.scrollTop;

    // ヘッダー判定
    if (y < EVENT_HEADER_HEIGHT) {
        if (x > EVENT_LEFT_PANEL_WIDTH) {
            event_state = 'scrub-time';
            event_updateSeekFromMouse(x);
        }
        return;
    }

    // トラックエリア
    let currentY = EVENT_HEADER_HEIGHT;
    for (let i = 0; i < event_data.layers.length; i++) {
        const layer = event_data.layers[i];

        // レイヤー行
        if (y >= currentY && y < currentY + EVENT_TRACK_HEIGHT) {
            if (x < EVENT_LEFT_PANEL_WIDTH) {
                // UI判定エリア (右端からのオフセットで判定)
                const fromRight = EVENT_LEFT_PANEL_WIDTH - x;

                // ゴミ箱 (表示位置: EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.TRASH_RIGHT, 幅: 20)
                if (fromRight >= UI_LAYOUT.TRASH_RIGHT - 20 && fromRight <= UI_LAYOUT.TRASH_RIGHT) {
                    if (confirm("レイヤーを削除しますか？")) {
                        event_pushHistory();
                        event_data.layers.splice(i, 1);
                        event_selectedLayerIndex = -1;
                        event_draw();
                    }
                    return;
                }

                // Pick Whip (◎) (表示位置:中心が EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.PICK_RIGHT + 8)
                if (fromRight >= UI_LAYOUT.PICK_RIGHT - 16 && fromRight <= UI_LAYOUT.PICK_RIGHT) {
                    event_state = 'drag-pickwhip';
                    event_pickWhipSourceLayerIdx = i;
                    event_dragStartPos = { x: e.clientX, y: e.clientY };
                    return;
                }

                // 親選択プルダウン (表示位置: EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.PARENT_RIGHT, 右側は PickWhip の左 5px)
                if (fromRight >= UI_LAYOUT.PICK_RIGHT + 5 && fromRight <= UI_LAYOUT.PARENT_RIGHT) {
                    event_showParentSelect(e.clientX, e.clientY, i);
                    return;
                }

                // 展開
                if (x < 25) {
                    layer.expanded = !layer.expanded;
                }
                // 並び替え (それ以外のエリア)
                else {
                    event_pushHistory();
                    event_state = 'drag-layer-order';
                    event_selectedLayerIndex = i;
                    event_dragTarget = { layerIdx: i };
                    event_dragStartPos = { x: e.clientX, y: e.clientY };
                }
                event_selectedLayerIndex = i;
                event_selectedKey = null;
                event_draw();
            } else {
                // タイムライン操作
                const inX = EVENT_LEFT_PANEL_WIDTH + (layer.inPoint - event_viewStartTime) * event_pixelsPerSec;
                const outX = EVENT_LEFT_PANEL_WIDTH + (layer.outPoint - event_viewStartTime) * event_pixelsPerSec;
                const hw = EVENT_LAYER_HANDLE_WIDTH;

                if (Math.abs(x - inX) <= hw) {
                    event_pushHistory();
                    event_state = 'drag-layer-in';
                    event_selectedLayerIndex = i;
                    event_dragTarget = { layerIdx: i };
                    event_dragStartPos = { x: e.clientX, y: e.clientY };
                } else if (Math.abs(x - outX) <= hw) {
                    event_pushHistory();
                    event_state = 'drag-layer-out';
                    event_selectedLayerIndex = i;
                    event_dragTarget = { layerIdx: i };
                    event_dragStartPos = { x: e.clientX, y: e.clientY };
                } else if (x > inX && x < outX) {
                    event_pushHistory();
                    event_state = 'drag-layer-move';
                    event_selectedLayerIndex = i;
                    event_dragTarget = { layerIdx: i, startIn: layer.inPoint, startOut: layer.outPoint };
                    event_dragStartPos = { x: e.clientX, y: e.clientY };
                } else {
                    event_selectedLayerIndex = i;
                    event_selectedKey = null;
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
                        // 左パネル
                        const fromRight = EVENT_LEFT_PANEL_WIDTH - x;
                        const curVal = event_getInterpolatedValue(i, prop, event_currentTime);

                        if (track.type === 'vector2') {
                            // X値 (表示位置: EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.VAL_VEC_X_RIGHT, 幅: VAL_VEC_WIDTH)
                            if (fromRight >= UI_LAYOUT.VAL_VEC_X_RIGHT - UI_LAYOUT.VAL_VEC_WIDTH && fromRight <= UI_LAYOUT.VAL_VEC_X_RIGHT) {
                                event_pushHistory();
                                event_state = 'check-value-edit';
                                event_dragStartPos = { x: e.clientX, y: e.clientY };
                                event_dragTarget = {
                                    type: 'value', layerIdx: i, prop: prop, subProp: 'x',
                                    startVal: curVal.x, step: track.step, trackType: 'vector2',
                                    originX: x, originY: y, min: track.min, max: track.max
                                };
                                return;
                            }
                            // Y値 (表示位置: EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.VAL_VEC_Y_RIGHT, 幅: VAL_VEC_WIDTH)
                            if (fromRight >= UI_LAYOUT.VAL_VEC_Y_RIGHT - UI_LAYOUT.VAL_VEC_WIDTH && fromRight <= UI_LAYOUT.VAL_VEC_Y_RIGHT) {
                                event_pushHistory();
                                event_state = 'check-value-edit';
                                event_dragStartPos = { x: e.clientX, y: e.clientY };
                                event_dragTarget = {
                                    type: 'value', layerIdx: i, prop: prop, subProp: 'y',
                                    startVal: curVal.y, step: track.step, trackType: 'vector2',
                                    originX: x, originY: y, min: track.min, max: track.max
                                };
                                return;
                            }
                        } else {
                            // Single Value (表示位置: EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.VAL_SINGLE_RIGHT, 幅: VAL_SINGLE_WIDTH)
                            if (fromRight >= UI_LAYOUT.VAL_SINGLE_RIGHT - UI_LAYOUT.VAL_SINGLE_WIDTH && fromRight <= UI_LAYOUT.VAL_SINGLE_RIGHT) {
                                event_pushHistory();
                                event_state = 'check-value-edit';
                                event_dragStartPos = { x: e.clientX, y: e.clientY };
                                event_dragTarget = {
                                    type: 'value', layerIdx: i, prop: prop,
                                    startVal: curVal, step: track.step, trackType: track.type,
                                    originX: x, originY: y, min: track.min, max: track.max
                                };
                                return;
                            }
                        }

                        // キーフレーム追加ボタン (表示位置: 中心が EVENT_LEFT_PANEL_WIDTH - UI_LAYOUT.KEY_ADD_RIGHT)
                        if (fromRight >= UI_LAYOUT.KEY_ADD_RIGHT - 10 && fromRight <= UI_LAYOUT.KEY_ADD_RIGHT + 10) {
                            event_pushHistory();
                            const val = event_getInterpolatedValue(i, prop, event_currentTime);
                            const newKey = event_updateKeyframe(i, prop, event_currentTime, val);
                            event_selectedKey = { layerIdx: i, prop: prop, keyObj: newKey };
                            event_draw();
                            return;
                        }

                    } else {
                        // キーフレーム選択
                        let hit = false;
                        for (let k = 0; k < track.keys.length; k++) {
                            const key = track.keys[k];
                            const kx = EVENT_LEFT_PANEL_WIDTH + (key.time - event_viewStartTime) * event_pixelsPerSec;
                            if (Math.abs(x - kx) <= EVENT_KEYFRAME_HIT_RADIUS) {
                                event_pushHistory();
                                event_state = 'drag-key';
                                event_dragTarget = { type: 'key', obj: key, layerIdx: i, prop: prop };
                                event_selectedKey = { layerIdx: i, prop: prop, keyObj: key };
                                event_draw();
                                hit = true;
                                break;
                            }
                        }
                        if (!hit) {
                            // event_selectedKey = null; 
                        }
                    }
                    return;
                }
                currentY += EVENT_TRACK_HEIGHT;
            }
        }
    }
};

// --- マウス移動処理 ---
window.event_onGlobalMouseMove = function (e) {
    window.event_currentMouseX = e.clientX;
    window.event_currentMouseY = e.clientY;

    if (!document.getElementById('mode-event').classList.contains('active')) return;

    if (event_state === 'drag-pickwhip') {
        event_draw();
        return;
    }

    // カーソル処理 (idle時)
    if (event_state === 'idle') {
        const rect = event_canvasTimeline.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top + event_timelineContainer.scrollTop;

        let cursor = 'default';
        if (x > EVENT_LEFT_PANEL_WIDTH && y > EVENT_HEADER_HEIGHT) {
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

    if (event_state === 'resize-project') {
        const projectPanel = document.getElementById('event-project-panel');
        const newW = Math.max(50, Math.min(500, e.clientX));
        projectPanel.style.width = newW + 'px';
        return;
    }

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
            // subProp (x or y) を見て個別更新
            const currentVec = event_getInterpolatedValue(target.layerIdx, target.prop, event_currentTime);
            newVal = { ...currentVec };
            // Vector2のドラッグは開始時の値 + delta
            newVal[target.subProp] = target.startVal + delta * target.step;
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
        event_updateKeyframe(event_dragTarget.layerIdx, "position", event_currentTime, { x: newX, y: newY });
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
    else if (event_state === 'drag-layer-order') {
        const rect = event_canvasTimeline.getBoundingClientRect();
        const y = e.clientY - rect.top + event_timelineContainer.scrollTop;

        let currentY = EVENT_HEADER_HEIGHT;
        let targetIdx = -1;

        for (let i = 0; i < event_data.layers.length; i++) {
            const layerHeight = EVENT_TRACK_HEIGHT + (event_data.layers[i].expanded ? Object.keys(event_data.layers[i].tracks).length * EVENT_TRACK_HEIGHT : 0);
            if (y >= currentY && y < currentY + layerHeight) {
                targetIdx = i;
                break;
            }
            currentY += layerHeight;
        }

        if (targetIdx !== -1 && targetIdx !== event_dragTarget.layerIdx) {
            const fromIdx = event_dragTarget.layerIdx;
            const item = event_data.layers.splice(fromIdx, 1)[0];
            event_data.layers.splice(targetIdx, 0, item);

            event_dragTarget.layerIdx = targetIdx;
            event_selectedLayerIndex = targetIdx;
            event_draw();
        }
    }
};

// --- マウスアップ処理 ---
window.event_onGlobalMouseUp = function (e) {
    if (event_state === 'drag-pickwhip') {
        // ドロップ位置判定
        const rect = event_canvasTimeline.getBoundingClientRect();
        const y = e.clientY - rect.top + event_timelineContainer.scrollTop;
        const x = e.clientX - rect.left;

        let currentY = EVENT_HEADER_HEIGHT;
        let targetLayerIdx = -1;

        for (let i = 0; i < event_data.layers.length; i++) {
            const layer = event_data.layers[i];
            if (y >= currentY && y < currentY + EVENT_TRACK_HEIGHT) {
                if (x < EVENT_LEFT_PANEL_WIDTH) {
                    targetLayerIdx = i;
                }
                break;
            }
            currentY += EVENT_TRACK_HEIGHT;
            if (layer.expanded) currentY += Object.keys(layer.tracks).length * EVENT_TRACK_HEIGHT;
        }

        if (targetLayerIdx !== -1 && targetLayerIdx !== event_pickWhipSourceLayerIdx) {
            event_pushHistory();
            const childIdx = event_pickWhipSourceLayerIdx;
            const parentId = event_data.layers[targetLayerIdx].id;
            event_setLayerParent(childIdx, parentId);
        }

        event_pickWhipSourceLayerIdx = -1;
        event_state = 'idle';
        event_draw();
        return;
    }

    if (event_state === 'check-value-edit') {
        const target = event_dragTarget;
        let initStr = "";

        // インライン入力用の初期値
        if (target.trackType === 'vector2') {
            // 個別入力なので単一の値を表示
            initStr = target.startVal.toFixed(1);
        } else if (target.trackType === 'rotation') {
            const r = Math.floor(target.startVal / 360);
            const d = Math.floor(target.startVal % 360);
            initStr = `${r}+${d}`;
        } else {
            initStr = target.startVal.toString();
        }

        if (target.trackType === 'string') {
            const options = event_getLayerAnimationNames(target.layerIdx);
            event_showEnumSelect(target.originX - 40, target.originY, target.startVal, options, (newVal) => {
                event_pushHistory();
                event_updateKeyframe(target.layerIdx, target.prop, event_currentTime, newVal);
                event_draw();
            });
        } else {
            event_showInlineInput(target.originX - 40, target.originY, initStr, target.trackType, (newVal) => {
                event_pushHistory();
                if (target.trackType === 'vector2') {
                    const currentVec = event_getInterpolatedValue(target.layerIdx, target.prop, event_currentTime);
                    const finalVec = { ...currentVec };
                    const f = parseFloat(newVal);
                    if (!isNaN(f)) {
                        finalVec[target.subProp] = f;
                        event_updateKeyframe(target.layerIdx, target.prop, event_currentTime, finalVec);
                    }
                } else {
                    event_updateKeyframe(target.layerIdx, target.prop, event_currentTime, newVal);
                }
                event_draw();
            });
        }
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
window.event_onPreviewMouseDown = function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    const rect = event_canvasPreview.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const compMx = mx / event_previewScale;
    const compMy = my / event_previewScale;

    // レイヤーは逆順（手前順）で判定
    for (let i = 0; i < event_data.layers.length; i++) {
        const layer = event_data.layers[i];
        if (event_currentTime < layer.inPoint || event_currentTime > layer.outPoint) continue;
        if (!layer.imgObj) continue;

        const pos = event_getInterpolatedValue(i, "position", event_currentTime);
        const iw = layer.imgObj.naturalWidth || 64;
        const ih = layer.imgObj.naturalHeight || 64;

        if (compMx >= pos.x - iw / 2 && compMx <= pos.x + iw / 2 && compMy >= pos.y - ih / 2 && compMy <= pos.y + ih / 2) {
            event_pushHistory();
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
window.event_onKeyDown = function (e) {
    if (e.target.tagName === 'INPUT') return;
    const modeEvent = document.getElementById('mode-event');
    if (!modeEvent || !modeEvent.classList.contains('active')) return;

    if (e.code === 'F9') {
        if (event_selectedKey) {
            e.preventDefault();
            event_pushHistory();
            event_selectedKey.keyObj.easing = 'EaseInOut';
            console.log("Keyframe set to EaseInOut");
            event_draw();
        }
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
        event_copySelectedKeyframe();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
        event_pushHistory();
        event_pasteKeyframe();
        return;
    }

    const isUndo = (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'z');
    if (isUndo) {
        e.preventDefault();
        event_undo();
        return;
    }

    if (e.code === 'Space') { e.preventDefault(); event_togglePlay(); }
    else if (e.code === 'KeyJ') { event_jumpToPrevKeyframe(); }
    else if (e.code === 'KeyK') { event_jumpToNextKeyframe(); }
    else if (e.code === 'Delete' || e.code === 'Backspace') {
        event_pushHistory();
        event_deleteSelectedKeyframe();
    }

    if (e.code === 'KeyU') {
        if (event_selectedLayerIndex !== -1) {
            const layer = event_data.layers[event_selectedLayerIndex];
            layer.expanded = !layer.expanded;
            event_draw();
        }
    }

    if (e.altKey && event_selectedLayerIndex !== -1) {
        if (e.code === 'BracketLeft') {
            e.preventDefault();
            event_pushHistory();
            event_data.layers[event_selectedLayerIndex].inPoint = event_snapTime(event_currentTime);
            if (event_data.layers[event_selectedLayerIndex].inPoint > event_data.layers[event_selectedLayerIndex].outPoint) {
                event_data.layers[event_selectedLayerIndex].inPoint = event_data.layers[event_selectedLayerIndex].outPoint;
            }
            event_draw();
        } else if (e.code === 'BracketRight') {
            e.preventDefault();
            event_pushHistory();
            event_data.layers[event_selectedLayerIndex].outPoint = event_snapTime(event_currentTime);
            if (event_data.layers[event_selectedLayerIndex].outPoint < event_data.layers[event_selectedLayerIndex].inPoint) {
                event_data.layers[event_selectedLayerIndex].outPoint = event_data.layers[event_selectedLayerIndex].inPoint;
            }
            event_draw();
        }
    }
};

// --- インライン入力表示 ---
window.event_showInlineInput = function (x, y, initialValue, trackType, callback) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = initialValue;
    input.style.position = 'absolute';
    input.style.left = `${x}px`;
    input.style.top = `${y}px`;
    input.style.width = '80px';
    input.style.zIndex = '1000';

    let committed = false;
    const commit = () => {
        if (committed) return;
        committed = true;
        const valStr = input.value;
        let finalVal = null;

        // Vector2の個別入力時は単一数値としてパース
        // ただし trackType が vector2 のままだと既存ロジックが vector2 パースしようとするので注意が必要だが、
        // コールバック内で処理分けしているのでここでは単純に値を渡すだけで良い。
        // event_onGlobalMouseUp のコールバックで型に応じた処理をしている。

        // 既存のパースロジック（Single Value）
        if (trackType === 'rotation') {
            if (valStr.includes('+')) {
                const parts = valStr.split('+');
                const rev = parseFloat(parts[0]);
                const deg = parseFloat(parts[1]);
                if (!isNaN(rev) && !isNaN(deg)) finalVal = rev * 360 + deg;
            } else {
                const f = parseFloat(valStr);
                if (!isNaN(f)) finalVal = f;
            }
        } else if (trackType === 'string') {
            finalVal = valStr;
        } else {
            const f = parseFloat(valStr);
            if (!isNaN(f)) finalVal = f;
        }

        if (finalVal !== null) callback(finalVal);
        if (input.parentNode) input.parentNode.removeChild(input);
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            commit();
        }
    });
    input.addEventListener('blur', commit);

    event_timelineContainer.appendChild(input);
    input.focus();
};

// --- 親選択プルダウン表示 ---
window.event_showParentSelect = function (x, y, childLayerIdx) {
    const select = document.createElement('select');
    select.style.position = 'absolute';
    select.style.left = x + 'px';
    select.style.top = y + 'px';
    select.style.zIndex = '1000';
    select.style.width = '120px';

    const optNone = document.createElement('option');
    optNone.value = "";
    optNone.text = "なし";
    select.appendChild(optNone);

    const currentParentId = event_data.layers[childLayerIdx].parent;
    const currentId = event_data.layers[childLayerIdx].id;

    event_data.layers.forEach(l => {
        if (l.id === currentId) return;
        const opt = document.createElement('option');
        opt.value = l.id;
        opt.text = l.name;
        if (l.id === currentParentId) opt.selected = true;
        select.appendChild(opt);
    });

    let changed = false;
    const commit = () => {
        if (changed) return;
        changed = true;

        event_pushHistory();
        const newVal = select.value;
        event_setLayerParent(childLayerIdx, newVal || null);

        if (select.parentNode) select.parentNode.removeChild(select);
    };

    select.addEventListener('change', commit);
    select.addEventListener('blur', () => {
        if (select.parentNode) select.parentNode.removeChild(select);
    });

    document.body.appendChild(select);
    select.focus();
};

/**
 * リストから選択するプルダウンメニューを表示
 */
window.event_showEnumSelect = function (x, y, initialValue, options, callback) {
    const select = document.createElement('select');
    select.style.position = 'absolute';

    // 画面座標に変換 (キャンバスの絶対位置を考慮)
    const rect = event_canvasTimeline.getBoundingClientRect();
    select.style.left = (rect.left + x) + 'px';
    select.style.top = (rect.top + y - event_timelineContainer.scrollTop) + 'px';

    select.style.zIndex = '1000';
    select.style.width = '100px';

    options.forEach(optVal => {
        const opt = document.createElement('option');
        opt.value = optVal;
        opt.text = optVal;
        if (optVal === initialValue) opt.selected = true;
        select.appendChild(opt);
    });

    let committed = false;
    const commit = () => {
        if (committed) return;
        committed = true;
        callback(select.value);
        if (select.parentNode) select.parentNode.removeChild(select);
    };

    select.addEventListener('change', commit);
    select.addEventListener('blur', commit);
    document.body.appendChild(select);
    select.focus();
};