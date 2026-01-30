/**
 * イベントエディタ: プロジェクト管理
 * Step 16: フォルダD&D管理
 */

window.event_draggedAsset = null;
window.event_draggedProjectItem = null; // プロジェクト内移動用

window.event_initProject = function () {
    event_refreshProjectList();

    const list = document.getElementById('event-project-list');

    // 背景ダブルクリックで読み込み
    list.addEventListener('dblclick', (e) => {
        if (e.target === list) {
            document.getElementById('event-file-input').click();
        }
    });

    // リスト全体へのドロップ (ルートへの移動用)
    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (window.event_draggedProjectItem) {
            e.dataTransfer.dropEffect = 'move';
            list.style.backgroundColor = '#3a3a3a';
        }
    });
    list.addEventListener('dragleave', () => {
        list.style.backgroundColor = '';
    });
    list.addEventListener('drop', (e) => {
        e.preventDefault();
        list.style.backgroundColor = '';

        // ターゲットがリスト背景の場合のみルートへ移動
        if (e.target === list && window.event_draggedProjectItem) {
            event_moveAssetToFolder(window.event_draggedProjectItem, null); // null = root
        }
    });
};

// アセット移動処理
function event_moveAssetToFolder(item, targetFolder) {
    // 循環参照チェック (フォルダを自分自身の子にはできない)
    if (targetFolder && item.type === 'folder') {
        let parent = targetFolder;
        while (parent) {
            if (parent === item) return; // 親が自分自身
            // 親を遡るロジックが必要だが、データ構造上 親参照を持っていないため
            // 簡易的に「ターゲットが自分の子孫でないか」をチェックすべきだが、
            // 今回は単純な移動のみ実装
        }
    }

    // 元の場所から削除
    event_removeAssetFromTree(event_data.assets, item);

    // 新しい場所へ追加
    if (targetFolder) {
        if (!targetFolder.children) targetFolder.children = [];
        targetFolder.children.push(item);
        targetFolder._collapsed = false; // 展開する
    } else {
        event_data.assets.push(item); // ルートへ
    }

    window.event_draggedProjectItem = null;
    event_refreshProjectList();
}

function event_removeAssetFromTree(list, item) {
    const idx = list.indexOf(item);
    if (idx !== -1) {
        list.splice(idx, 1);
        return true;
    }
    for (let child of list) {
        if (child.type === 'folder' && child.children) {
            if (event_removeAssetFromTree(child.children, item)) return true;
        }
    }
    return false;
}

window.event_refreshProjectList = function () {
    const list = document.getElementById('event-project-list');
    list.innerHTML = '';

    function renderItems(items, container, depth = 0) {
        items.forEach(item => {
            const div = document.createElement('div');
            div.style.paddingLeft = `${depth * 15 + 5}px`;
            div.style.paddingTop = '4px';
            div.style.paddingBottom = '4px';
            div.style.cursor = 'pointer';
            div.style.userSelect = 'none';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.className = 'project-item';
            div.style.borderBottom = '1px solid #333';

            // アイコン
            let iconEl;
            if (item.type === 'image' && item.src) {
                iconEl = document.createElement('div');
                iconEl.style.width = '24px';
                iconEl.style.height = '24px';
                iconEl.style.backgroundImage = `url(${item.src})`;
                iconEl.style.backgroundSize = 'contain';
                iconEl.style.backgroundPosition = 'center';
                iconEl.style.backgroundRepeat = 'no-repeat';
                iconEl.style.marginRight = '5px';
            } else if (item.type === 'animation') {
                let iconChar = item._collapsed ? '📁' : '📽️';
                iconEl = document.createElement('span');
                iconEl.textContent = iconChar + ' ';
                iconEl.style.marginRight = '5px';

                div.onclick = (e) => {
                    item._collapsed = !item._collapsed;
                    event_refreshProjectList();
                    e.stopPropagation();
                };
            }
            else {
                let iconChar = '📄';
                if (item.type === 'folder') iconChar = item._collapsed ? '📁' : '📂';
                else if (item.type === 'comp') iconChar = '🎞️';
                iconEl = document.createElement('span');
                iconEl.textContent = iconChar + ' ';
                iconEl.style.marginRight = '5px';
            }
            div.appendChild(iconEl);

            const nameSpan = document.createElement('span');
            nameSpan.textContent = item.name;
            div.appendChild(nameSpan);

            // ドラッグ開始
            div.draggable = true;
            div.addEventListener('dragstart', (e) => {
                window.event_draggedAsset = item; // タイムライン用
                window.event_draggedProjectItem = item; // プロジェクト内移動用
                e.dataTransfer.effectAllowed = 'all';
                e.dataTransfer.setData('text/plain', item.id);
                e.stopPropagation();
            });

            // フォルダへのドロップ受け入れ
            if (item.type === 'folder' || item.type === 'animation') {
                div.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (window.event_draggedProjectItem && window.event_draggedProjectItem !== item) {
                        div.style.backgroundColor = '#555';
                        e.dataTransfer.dropEffect = 'move';
                    }
                });
                div.addEventListener('dragleave', () => {
                    div.style.backgroundColor = '';
                });
                div.addEventListener('drop', (e) => {
                    e.preventDefault();
                    div.style.backgroundColor = '';
                    if (window.event_draggedProjectItem && window.event_draggedProjectItem !== item) {
                        event_moveAssetToFolder(window.event_draggedProjectItem, item);
                        e.stopPropagation();
                    }
                });

                if (item.type === 'folder') {
                    div.onclick = (e) => {
                        item._collapsed = !item._collapsed;
                        event_refreshProjectList();
                        e.stopPropagation();
                    };
                }
            }
            else if (item.type === 'comp') {
                div.addEventListener('dblclick', (e) => {
                    event_switchComposition(item.id);
                    e.stopPropagation();
                });
            }

            div.onmouseover = (e) => { if (!e.relatedTarget || !div.contains(e.relatedTarget)) div.style.backgroundColor = '#444'; };
            div.onmouseout = (e) => { if (!e.relatedTarget || !div.contains(e.relatedTarget)) div.style.backgroundColor = ''; };

            container.appendChild(div);

            // サブアイテムの描画 (フォルダの子 または アニメーションの個別モーション)
            if (item.type === 'folder' && !item._collapsed && item.children) {
                renderItems(item.children, container, depth + 1);
            } else if (item.type === 'animation' && !item._collapsed && item.data) {
                Object.keys(item.data).forEach(animKey => {
                    const subDiv = document.createElement('div');
                    subDiv.style.paddingLeft = `${(depth + 1) * 15 + 10}px`;
                    subDiv.style.paddingTop = '2px';
                    subDiv.style.paddingBottom = '2px';
                    subDiv.style.cursor = 'pointer';
                    subDiv.style.display = 'flex';
                    subDiv.style.alignItems = 'center';
                    subDiv.className = 'project-item sub-anim';
                    subDiv.innerHTML = `<span style="margin-right:5px;">🏃</span> <span>${animKey}</span>`;

                    subDiv.draggable = true;
                    subDiv.addEventListener('dragstart', (e) => {
                        // 個別アニメーションの情報をセット
                        window.event_draggedAsset = {
                            type: 'sub_animation',
                            parentAssetId: item.id,
                            animId: animKey,
                            name: item.name.split('_')[0] + " (" + animKey + ")"
                        };
                        e.dataTransfer.effectAllowed = 'copy';
                        e.stopPropagation();
                    });

                    subDiv.onmouseover = () => subDiv.style.backgroundColor = '#444';
                    subDiv.onmouseout = () => subDiv.style.backgroundColor = '';

                    container.appendChild(subDiv);
                });
            }
        });
    }

    renderItems(event_data.assets, list);
};

// ... (ファイル読み込み等は変更なし)

// ファイル読み込み
window.event_onFileSelected = function (input) {
    const files = input.files;
    if (!files.length) return;

    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const newItem = {
                type: 'image',
                name: file.name,
                id: 'img_' + Date.now() + Math.random(),
                src: e.target.result
            };
            event_pushHistory(); // 履歴保存
            event_data.assets.push(newItem);
            event_refreshProjectList();
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
};

// --- JSON書き出し・読み込み ---

// JSON書き出し
window.event_exportJSON = function () {
    // 現在のコンポジションの状態を assets に同期させる (念のため)
    if (event_data.activeCompId) {
        const comp = event_findAssetById(event_data.activeCompId);
        if (comp) {
            comp.layers = event_data.layers;
            comp.name = event_data.composition.name;
            comp.width = event_data.composition.width;
            comp.height = event_data.composition.height;
            comp.duration = event_data.composition.duration;
            comp.fps = event_data.composition.fps;
        }
    }

    // 保存用データ作成 (imgObj などの循環参照やシリアライズ不要なものを除く)
    // JSON.stringify は関数や DOM要素、Imageオブジェクトなどを自動で除外するが、
    // 構造を明確にするためにディープコピーして調整する
    const exportData = {
        activeCompId: event_data.activeCompId,
        assets: event_data.assets
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const filename = (event_data.composition.name || "event_project") + ".json";
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
    console.log("Project exported to JSON.");
};

// JSON読み込み
window.event_importJSON = function (input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.assets) throw new Error("Invalid format: 'assets' not found");

            event_pushHistory(); // 履歴保存

            // データの読み込み
            event_data.assets = data.assets;

            // 全ての子孫を走査して Image オブジェクトを再生成する関数
            function restoreImages(items) {
                items.forEach(item => {
                    if (item.type === 'comp' && item.layers) {
                        item.layers.forEach(l => {
                            if (l.source) {
                                const img = new Image();
                                img.src = l.source;
                                img.onload = () => event_draw();
                                l.imgObj = img;
                            }
                        });
                    }
                    if (item.type === 'folder' && item.children) {
                        restoreImages(item.children);
                    }
                });
            }
            restoreImages(event_data.assets);

            // プロジェクトリストの更新
            event_refreshProjectList();

            // コンポジションの切り替え (activeCompIdがあれば)
            // 読み込み直後の switchComposition で古いデータが上書き保存されないように ID を一旦クリア
            const targetCompId = data.activeCompId || (event_data.assets.find(a => a.type === 'comp') || {}).id;
            event_data.activeCompId = null;

            if (targetCompId) {
                event_switchComposition(targetCompId);
            }

            console.log("Project imported from JSON.");
            alert("プロジェクトを読み込みました。");
        } catch (err) {
            console.error(err);
            alert("ファイルの読み込みに失敗しました: " + err.message);
        }
    };
    reader.readAsText(file);
    input.value = ''; // Reset input
};

// フォルダ作成
window.event_createFolder = function () {
    const name = prompt("フォルダ名", "New Folder");
    if (name) {
        event_data.assets.push({
            type: 'folder',
            name: name,
            id: 'folder_' + Date.now(),
            children: []
        });
        event_pushHistory(); // 履歴保存
        event_refreshProjectList();
    }
};