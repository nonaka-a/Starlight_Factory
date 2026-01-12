/**
 * --- Craft 1: きじづくり ---
 */
const CraftMixing = {
    // UI
    ui: {
        btnUp: { x: 650, y: 280, w: 60, h: 60 },
        btnDown: { x: 290, y: 280, w: 60, h: 60 },
        btnStartPour: { x: 380, y: 400, w: 240, h: 60, text: "つくる！" }
    },

    // Data
    baseX: 500,
    baseY: 300,
    bowlRadius: 150,
    dragDistance: 0,
    blobPoints: [],
    pourWaitTimer: 0,

    // --- State: Select ---
    updateSelect: function() {
        if (Input.isJustPressed) {
            if (CraftManager.hitTest(this.ui.btnUp)) {
                if (CraftManager.craftAmount < CraftManager.maxCraftAmount) {
                    CraftManager.craftAmount++;
                    AudioSys.playTone(600, 'sine', 0.1);
                }
            }
            else if (CraftManager.hitTest(this.ui.btnDown)) {
                if (CraftManager.craftAmount > 1) {
                    CraftManager.craftAmount--;
                    AudioSys.playTone(500, 'sine', 0.1);
                }
            }
            else if (CraftManager.hitTest(this.ui.btnStartPour)) {
                if (typeof consumeCraftMaterials === 'function') {
                    consumeCraftMaterials(CraftManager.craftAmount);
                }
                this.initPouring();
                CraftManager.state = 'pouring';
                AudioSys.playTone(800, 'square', 0.1);
            }
        }
    },

    drawSelect: function(offsetX) {
        const ctx = CraftManager.ctx;
        const cx = offsetX + 500;
        const cy = 300;

        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 15;
        
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        const w = 600, h = 350;
        ctx.roundRect(cx - w/2, cy - h/2, w, h, 20);
        ctx.fill();
        
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 4;
        ctx.stroke(); 

        ctx.fillStyle = '#ff6b6b';
        ctx.font = "bold 32px 'M PLUS Rounded 1c', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText("ほしのもとを いれる", cx, cy - 100);

        ctx.fillStyle = '#555';
        ctx.font = "bold 18px 'M PLUS Rounded 1c', sans-serif";
        ctx.fillText("いくつ つくる？", cx, cy - 60);

        ctx.fillStyle = '#f9f9f9';
        ctx.beginPath();
        ctx.roundRect(cx - 100, cy - 40, 200, 100, 10);
        ctx.fill();
        
        ctx.fillStyle = '#333';
        ctx.font = "bold 64px 'M PLUS Rounded 1c', sans-serif";
        ctx.fillText(CraftManager.craftAmount, cx, cy + 30);
        
        ctx.fillStyle = '#888';
        ctx.font = "16px 'M PLUS Rounded 1c', sans-serif";
        ctx.fillText(`(消費: ${CraftManager.craftAmount * 5}個)`, cx, cy + 50);

        ctx.restore();

        CraftManager.drawTriangleBtn(this.ui.btnUp, true);
        CraftManager.drawTriangleBtn(this.ui.btnDown, false);
        CraftManager.drawBtn(this.ui.btnStartPour, '#4ecdc4');
    },

    // --- State: Pouring ---
    initPouring: function() {
        const cm = CraftManager;
        cm.currentStar.particles = [];
        const totalParticles = cm.craftAmount * 5;
        
        for (let i = 0; i < totalParticles; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * (this.bowlRadius - 20);
            const tx = this.baseX + Math.cos(angle) * r;
            const ty = this.baseY + Math.sin(angle) * r;

            cm.currentStar.particles.push({
                x: tx,
                y: -100 - Math.random() * 300,
                targetY: ty,
                targetX: tx, 
                vx: 0,
                vy: 0,
                r: 8 + Math.random() * 4,
                color: '#FFD700',
                isIngredient: true,
                settled: false
            });
        }
        
        this.blobPoints = [];
        for (let i = 0; i < 8; i++) {
            this.blobPoints.push({
                angle: (i / 8) * Math.PI * 2,
                r: 10, 
                targetR: 120
            });
        }
        this.pourWaitTimer = 0;
        this.dragDistance = 0;
    },

    updatePouring: function() {
        const cm = CraftManager;
        let settledCount = 0;
        const gravity = 0.8;

        for (const p of cm.currentStar.particles) {
            if (!p.isIngredient) continue;

            if (!p.settled) {
                p.vy += gravity;
                p.y += p.vy;

                if (p.y >= p.targetY) {
                    p.y = p.targetY;
                    if (Math.abs(p.vy) > 2) {
                        p.vy *= -0.4;
                        AudioSys.playNoise(0.05, 0.05);
                    } else {
                        p.vy = 0;
                        p.settled = true;
                    }
                }
            } else {
                settledCount++;
            }
        }

        if (settledCount === cm.currentStar.particles.length) {
            this.pourWaitTimer++;
            if (this.pourWaitTimer > 30) {
                cm.state = 'mixing';
            }
        }
    },

    // --- State: Mixing ---
    updateMix: function() {
        const cm = CraftManager;
        if (cm.currentStar.mixProgress >= 100) {
            cm.ui.btnNext.visible = true;
            return;
        }

        const mx = Input.x - cm.camera.x;
        const my = Input.y;
        
        if (Input.isDown) {
            const dx = mx - this.baseX;
            const dy = my - this.baseY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < this.bowlRadius) {
                this.dragDistance += 1.5;
                cm.currentStar.mixProgress = Math.min(100, this.dragDistance / 5);

                for (const p of cm.currentStar.particles) {
                    if (!p.isIngredient) continue;
                    const pdx = mx - p.x;
                    const pdy = my - p.y;
                    const pdist = Math.sqrt(pdx*pdx + pdy*pdy);
                    if (pdist < 60) {
                        p.x += (Math.random()-0.5) * 5;
                        p.y += (Math.random()-0.5) * 5;
                    }
                }
            }
        }

        const progress = cm.currentStar.mixProgress / 100;

        for (const p of cm.currentStar.particles) {
            if (!p.isIngredient) continue;
            if (progress > 0.2) {
                const cx = this.baseX;
                const cy = this.baseY;
                const dx = cx - p.x;
                const dy = cy - p.y;
                p.x += dx * 0.05 * progress + (Math.random()-0.5);
                p.y += dy * 0.05 * progress + (Math.random()-0.5);
            }
        }

        if (progress > 0) {
            for (const pt of this.blobPoints) {
                const wave = Math.sin(Date.now() / 150 + pt.angle * 3) * 5;
                pt.currentR = pt.r + (pt.targetR - pt.r) * progress + wave;
            }
        }
    },

    drawMixArea: function(offsetX) {
        const ctx = CraftManager.ctx;
        const cx = offsetX + this.baseX;
        const cy = this.baseY;

        ctx.fillStyle = '#5d4037';
        ctx.beginPath();
        ctx.arc(cx, cy, this.bowlRadius, 0, Math.PI * 2);
        ctx.fill();

        const progress = CraftManager.currentStar.mixProgress / 100;
        
        // Blob (Orange)
        if (progress > 0.1) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, progress); 
            ctx.fillStyle = '#FFA500'; 
            ctx.beginPath();
            const pts = this.blobPoints;
            for (let i = 0; i < pts.length; i++) {
                const pt = pts[i];
                const r = pt.currentR || 10;
                const x = cx + Math.cos(pt.angle) * r;
                const y = cy + Math.sin(pt.angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // Particles
        for (const p of CraftManager.currentStar.particles) {
            if (!p.isIngredient) continue;
            if (progress > 0.6) ctx.globalAlpha = 1 - (progress - 0.6) * 2.5; 
            else ctx.globalAlpha = 1.0;
            
            if (ctx.globalAlpha > 0) {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1.0;

        // Bowl Front
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(cx, cy, this.bowlRadius, 0, Math.PI * 2);
        ctx.stroke();

        if (CraftManager.state === 'mixing') {
            CraftManager.drawProgressBar(offsetX + 300, 150, CraftManager.currentStar.mixProgress, 100);
        }
    }
};