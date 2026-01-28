/**
 * イベントエディタ: ロジック (データ操作・計算・再生制御)
 */

// --- データ操作 ---
window.event_addLayer = function(name, source) {
    const img = new Image();
    img.src = source;
    img.onload = () => event_draw();

    const cx = event_data.composition.width / 2;
    const cy = event_data.composition.height / 2;

    event_data.layers.push({
        name: name,
        source: source,
        imgObj: img,
        expanded: true,
        inPoint: 0,
        outPoint: event_data.composition.duration,
        tracks: {
            "position": { label: "Position", type: "vector2", keys: [{ time: 0, value: {x: cx, y: cy} }], step: 1 },
            // 変更: Scale初期値を 100 に (min/max/stepも調整)
            "scale": { label: "Scale", type: "number", keys: [{ time: 0, value: 100 }], min: 0, max: 1000, step: 1 },
            "rotation": { label: "Rotation", type: "rotation", keys: [{ time: 0, value: 0 }], min: -3600, max: 3600, step: 1 },
            "opacity": { label: "Opacity", type: "number", keys: [{ time: 0, value: 100 }], min: 0, max: 100, step: 1 }
        }
    });
    event_selectedLayerIndex = event_data.layers.length - 1;
};

window.event_updateKeyframe = function(layerIndex, prop, time, value) {
    time = event_snapTime(time);
    const track = event_data.layers[layerIndex].tracks[prop];
    
    if (track.type === 'number') {
        if (track.min !== undefined) value = Math.max(track.min, value);
        if (track.max !== undefined) value = Math.min(track.max, value);
    }
    
    const existingKey = track.keys.find(k => Math.abs(k.time - time) < 0.001);
    const valToSave = (typeof value === 'object') ? { ...value } : value;
    
    if (existingKey) {
        existingKey.value = valToSave;
        return existingKey;
    } else {
        const newKey = { time: time, value: valToSave };
        track.keys.push(newKey);
        track.keys.sort((a, b) => a.time - b.time);
        return newKey;
    }
};

window.event_deleteSelectedKeyframe = function() {
    if (!event_selectedKey) return;
    const { layerIdx, prop, keyObj } = event_selectedKey;
    const track = event_data.layers[layerIdx].tracks[prop];
    const index = track.keys.indexOf(keyObj);
    if (index !== -1) {
        track.keys.splice(index, 1);
        event_selectedKey = null;
        event_draw();
    }
};

// --- FPSスナップ処理 ---
window.event_snapTime = function(time) {
    const fps = event_data.composition.fps || 30;
    const frameDuration = 1 / fps;
    const frame = Math.round(time / frameDuration);
    return frame * frameDuration;
};

// --- 補間計算 ---
window.event_getInterpolatedValue = function(layerIndex, prop, time) {
    const track = event_data.layers[layerIndex].tracks[prop];
    if (!track.keys.length) {
        if (track.type === 'vector2') return {x:0, y:0};
        return 0;
    }
    const keys = track.keys;
    if (keys.length === 1) return keys[0].value;
    if (time <= keys[0].time) return keys[0].value;
    if (time >= keys[keys.length - 1].time) return keys[keys.length - 1].value;

    for (let i = 0; i < keys.length - 1; i++) {
        const k1 = keys[i];
        const k2 = keys[i + 1];
        if (time >= k1.time && time < k2.time) {
            const t = (time - k1.time) / (k2.time - k1.time);
            if (typeof k1.value === 'number') {
                return k1.value + (k2.value - k1.value) * t;
            } else if (typeof k1.value === 'object') {
                return {
                    x: k1.value.x + (k2.value.x - k1.value.x) * t,
                    y: k1.value.y + (k2.value.y - k1.value.y) * t
                };
            }
        }
    }
    return keys[0].value;
};

// --- 再生制御 ---
window.event_seekTo = function (time) {
    event_currentTime = Math.max(0, time);
    event_draw();
};

window.event_togglePlay = function () {
    event_isPlaying = !event_isPlaying;
    const btn = document.getElementById('btn-event-play');
    if (btn) btn.textContent = event_isPlaying ? '⏸' : '▶';
    if (event_isPlaying) event_lastTimestamp = performance.now();
};

window.event_stop = function () {
    event_isPlaying = false;
    event_currentTime = 0;
    event_viewStartTime = 0;
    document.getElementById('btn-event-play').textContent = '▶';
    event_draw();
};

window.event_jumpToPrevKeyframe = function() {
    let targetTime = -1;
    event_data.layers.forEach(l => {
        Object.values(l.tracks).forEach(t => {
            t.keys.forEach(k => {
                if (k.time < event_currentTime - 0.001) {
                    if (k.time > targetTime) targetTime = k.time;
                }
            });
        });
    });
    if (targetTime !== -1) event_seekTo(targetTime);
};

window.event_jumpToNextKeyframe = function() {
    let targetTime = Infinity;
    event_data.layers.forEach(l => {
        Object.values(l.tracks).forEach(t => {
            t.keys.forEach(k => {
                if (k.time > event_currentTime + 0.001) {
                    if (k.time < targetTime) targetTime = k.time;
                }
            });
        });
    });
    if (targetTime !== Infinity) event_seekTo(targetTime);
};

// --- コンポジション設定 ---
window.event_openCompSettings = function() {
    const comp = event_data.composition;
    document.getElementById('inp-comp-name').value = comp.name;
    document.getElementById('inp-comp-w').value = comp.width;
    document.getElementById('inp-comp-h').value = comp.height;
    document.getElementById('inp-comp-duration').value = comp.duration;
    document.getElementById('inp-comp-fps').value = comp.fps;
    document.getElementById('event-comp-modal').style.display = 'flex';
};

window.event_applyCompSettings = function(isInit = false) {
    if (!isInit) {
        const name = document.getElementById('inp-comp-name').value;
        const w = parseInt(document.getElementById('inp-comp-w').value) || 800;
        const h = parseInt(document.getElementById('inp-comp-h').value) || 450;
        const dur = parseFloat(document.getElementById('inp-comp-duration').value) || 10;
        const fps = parseInt(document.getElementById('inp-comp-fps').value) || 30;
        
        event_data.composition.name = name;
        event_data.composition.width = w;
        event_data.composition.height = h;
        event_data.composition.duration = dur;
        event_data.composition.fps = fps;
        
        document.getElementById('event-comp-modal').style.display = 'none';
    }
    
    const nameDisplay = document.getElementById('event-comp-name-display');
    if (nameDisplay) nameDisplay.textContent = event_data.composition.name;

    if (event_currentTime > event_data.composition.duration) {
        event_currentTime = event_data.composition.duration;
    }
    event_currentTime = event_snapTime(event_currentTime);
    event_draw();
};