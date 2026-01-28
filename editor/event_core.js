/**
 * イベントエディタ: コア (変数定義・初期化・ループ)
 */

// --- 変数定義 ---
// 描画コンテキスト
let event_ctxPreview, event_canvasPreview;
let event_ctxTimeline, event_canvasTimeline;
let event_timelineContainer;
let event_previewContainer, event_timelinePanel;

// 状態フラグ
let event_initialized = false;
let event_isPlaying = false;
let event_currentTime = 0;
let event_lastTimestamp = 0;

// 表示設定
let event_pixelsPerSec = 50;
let event_viewStartTime = 0;
let event_previewZoomMode = 'fit';
let event_previewScale = 1.0;

// データ構造
let event_data = {
    composition: {
        name: "New Composition",
        width: 1000,
        height: 600,
        duration: 10,
        fps: 30
    },
    layers: []
};

// UI定数
const EVENT_HEADER_HEIGHT = 25;
const EVENT_TRACK_HEIGHT = 30;
const EVENT_LEFT_PANEL_WIDTH = 250;
const EVENT_KEYFRAME_SIZE = 6;
const EVENT_KEYFRAME_HIT_RADIUS = 8;
const EVENT_VALUE_CLICK_WIDTH = 80;
const EVENT_LAYER_HANDLE_WIDTH = 6;

// 操作ステート
let event_state = 'idle';
let event_dragStartPos = { x: 0, y: 0 };
let event_dragTarget = null; 
let event_selectedLayerIndex = -1;
let event_selectedKey = null;

// --- 初期化 ---
window.initEventEditor = function () {
    if (event_initialized) return;

    // DOM取得
    event_canvasPreview = document.getElementById('event-preview-canvas');
    event_canvasTimeline = document.getElementById('event-timeline-canvas');
    event_timelineContainer = document.getElementById('event-timeline-container');
    event_previewContainer = document.getElementById('event-preview-container');
    event_timelinePanel = document.getElementById('event-timeline-panel');
    const resizeHandle = document.getElementById('event-resize-handle');

    // 要素確認
    if (!event_canvasPreview || !event_canvasTimeline) {
        return; // まだDOMがない場合はスキップ
    }

    console.log("Event Editor Initializing...");

    event_ctxPreview = event_canvasPreview.getContext('2d');
    event_ctxTimeline = event_canvasTimeline.getContext('2d');

    // イベントリスナー設定 (event_input.js で定義された関数を使用)
    event_canvasTimeline.addEventListener('mousedown', event_onTimelineMouseDown);
    window.addEventListener('mousemove', event_onGlobalMouseMove);
    window.addEventListener('mouseup', event_onGlobalMouseUp);
    
    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', (e) => {
            event_state = 'resize-panel';
            event_dragStartPos = { x: e.clientX, y: e.clientY };
            e.preventDefault();
        });
    }

    event_canvasPreview.addEventListener('mousedown', event_onPreviewMouseDown);

    // キーボードイベント
    window.addEventListener('keydown', event_onKeyDown);

    // 初期データ作成
    if (event_data.layers.length === 0) {
        event_addLayer("Siro Maimai", "siro_maimai_1.png");
    }

    // 初期設定反映
    event_applyCompSettings(true);
    
    const zoomInput = document.getElementById('event-zoom');
    if (zoomInput) {
        event_pixelsPerSec = parseInt(zoomInput.value);
    }
    
    requestAnimationFrame(event_loop);
    event_initialized = true;
};

// --- メインループ ---
function event_loop(timestamp) {
    const modeEvent = document.getElementById('mode-event');
    if (!modeEvent) return;

    if (modeEvent.classList.contains('active')) {
        if (event_isPlaying) {
            if (!event_lastTimestamp) event_lastTimestamp = timestamp;
            const deltaTime = (timestamp - event_lastTimestamp) / 1000;
            event_currentTime += deltaTime;
            
            if (event_currentTime > event_data.composition.duration) {
                event_currentTime = 0;
            }
            
            const canvasW = event_canvasTimeline ? event_canvasTimeline.width : 0;
            const timelineW = canvasW - EVENT_LEFT_PANEL_WIDTH;
            const headScreenX = (event_currentTime - event_viewStartTime) * event_pixelsPerSec;
            if (headScreenX > timelineW * 0.9) {
                event_viewStartTime = event_currentTime - (timelineW * 0.1) / event_pixelsPerSec;
            }
        }
        event_lastTimestamp = timestamp;
        event_draw();
    } else {
        event_isPlaying = false;
    }
    requestAnimationFrame(event_loop);
}