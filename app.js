let isStudying = false;
        let studyStartTime = null;
        let studyDuration = 0;
        let targetTime = 0;
        let currentStudyType = '练字';
        let timerInterval = null;
        let wakeLockInterval = null;
        let wakeLock = null;
        let wakeAudioContext = null;
        let records = [];
        let pieChartDate = new Date();
        let showAllDays = false;
        let pieChartAnimProgress = 1;
        let pieChartAnimId = null;
        let pieChartCurrentData = null;
        let pieChartCurrentEmpty = false;
        let lineChartAnimProgress = 1;
        let lineChartAnimId = null;
        let lineChartCurrentConfig = null;
        let lineChartMousePos = null;

        const soundFiles = [
            { name: '淅淅小雨', file: '世界公认最佳放松雷雨声, 树林自然雨声睡眠音乐，白噪音-雨&雨声.mp3', color: '#74b9ff' },
            { name: '森林午夜', file: '大自然的声音_ 森林在午夜-Jamie Llewellyn.mp3', color: '#2ed573' },
            { name: '空调', file: '白噪音 冷气1-睡眠宝宝贵族音乐.mp3', color: '#a4b0be' },
            { name: '风的心跳', file: '白噪音 风+心跳1-睡眠宝宝贵族音乐.mp3', color: '#a4b0be' },
            { name: '树林草原', file: '白噪音（树林，草原，水声）-白噪音制造器.mp3', color: '#2ed573' },
            { name: '篝火风雨', file: '篝火和風雨交加的夜晚-自然的聲音.mp3', color: '#ff6b81' },
            { name: '雷雨之夜', file: '雨声-X303FFF.mp3', color: '#70a1ff' }
        ];

        let currentSoundIndex = -1;

        function mergeShortRecords(records) {
            if (records.length === 0) return [];

            const sortedRecords = [...records].sort((a, b) => {
                const dateCompare = a.date.localeCompare(b.date);
                if (dateCompare !== 0) return dateCompare;
                return a.startTime.localeCompare(b.startTime);
            });

            const merged = [];
            let currentGroup = [sortedRecords[0]];

            for (let i = 1; i < sortedRecords.length; i++) {
                const current = sortedRecords[i];
                const last = currentGroup[currentGroup.length - 1];

                const isShortDuration = current.duration < 600;
                const isSameDate = current.date === last.date;
                
                if (isSameDate && isShortDuration && last.duration < 600) {
                    currentGroup.push(current);
                } else {
                    merged.push(currentGroup);
                    currentGroup = [current];
                }
            }
            merged.push(currentGroup);

            return merged;
        }

        function loadRecords() {
            const saved = localStorage.getItem('studyRecords');
            records = saved ? JSON.parse(saved) : [];
        }

        function saveRecords() {
            localStorage.setItem('studyRecords', JSON.stringify(records));
        }

        function saveStudyState() {
            const state = {
                isStudying: isStudying,
                studyStartTime: studyStartTime,
                targetTime: targetTime,
                isPaused: isPaused,
                totalPauseTime: totalPauseTime,
                pauseStartTime: pauseStartTime,
                currentStudyType: currentStudyType
            };
            localStorage.setItem('studyState', JSON.stringify(state));
        }

        function loadStudyState() {
            const saved = localStorage.getItem('studyState');
            if (saved) {
                const state = JSON.parse(saved);
                if (state.isStudying && state.studyStartTime) {
                    isStudying = true;
                    studyStartTime = state.studyStartTime;
                    targetTime = state.targetTime;
                    isPaused = state.isPaused || false;
                    totalPauseTime = state.totalPauseTime || 0;
                    pauseStartTime = state.pauseStartTime || 0;
                    currentStudyType = state.currentStudyType || '练字';
                    lastRestReminderMinute = 0;
                    
                    let currentPauseTime = 0;
                    if (isPaused && pauseStartTime > 0) {
                        currentPauseTime = Date.now() - pauseStartTime;
                        // 如果暂停时间超过24小时，认为是旧状态，重置为0
                        if (currentPauseTime > 24 * 60 * 60 * 1000) {
                            currentPauseTime = 0;
                            isPaused = false;
                            pauseStartTime = 0;
                        }
                    }
                    studyDuration = Math.max(0, Math.floor((Date.now() - studyStartTime - totalPauseTime - currentPauseTime) / 1000));
                    
                    document.getElementById('startBtn').style.display = 'none';
                    document.getElementById('recordsBtn').style.display = 'none';
                    document.getElementById('stopBtn').classList.add('visible');
                    document.getElementById('breakBtn').classList.add('visible');
                    document.getElementById('studyDisplay').style.display = 'block';
                    document.getElementById('studyTime').innerHTML = formatTime(studyDuration);
                    
                    if (targetTime > 0) {
                        document.getElementById('studyStatus').innerHTML = `目标: ${formatTime(targetTime)}`;
                    } else {
                        document.getElementById('studyStatus').textContent = '';
                    }
                    
                    if (!isPaused) {
                        timerInterval = setInterval(updateStudyTime, 1000);
                        startWakeLockTimer();
                    } else {
                        document.getElementById('breakBtn').innerHTML = '▶️ 继续自习';
                        document.getElementById('breakBtn').classList.add('paused');
                        document.getElementById('studyStatus').textContent = '课间休息中...';
                    }
                }
            }
        }

        function updateCurrentTime() {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const timeText = document.getElementById('currentTimeText');
            if (timeText) {
                timeText.innerHTML = `${hours}:${minutes}<span class="seconds">:${seconds}</span>`;
            }
        }

        function formatTime(totalSeconds, withHTML = true) {
            const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
            const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
            const seconds = String(totalSeconds % 60).padStart(2, '0');
            if (withHTML) {
                return `${hours}:${minutes}<span class="seconds">:${seconds}</span>`;
            }
            return `${hours}:${minutes}:${seconds}`;
        }

        function formatHM(minutes) {
            if (minutes < 60) return minutes + 'm';
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            return m > 0 ? `${h}h ${m}m` : `${h}h`;
        }

        function updateStudyTime() {
            if (!isStudying) return;

            studyDuration = Math.floor((Date.now() - studyStartTime - totalPauseTime) / 1000);
            document.getElementById('studyTime').innerHTML = formatTime(studyDuration);

            if (targetTime > 0 && studyDuration >= targetTime) {
                playBeepBeepBeep();
                setTimeout(() => {
                    alert('恭喜！你已完成设定的学习时间！');
                    executeStopStudy();
                }, 100);
            }

            const minutes = Math.floor(studyDuration / 60);
            const settings = getSettings();
            const restTime = settings.restReminderTime || 50;
            if (minutes > 0 && minutes % restTime === 0 && studyDuration % 60 === 0 && minutes !== lastRestReminderMinute) {
                lastRestReminderMinute = minutes;
                showRestReminder(restTime);
            }
            
            if (studyDuration % 5 === 0) {
                saveStudyState();
            }
        }

        function showRestReminder(restTime = 50) {
            const reminder = document.createElement('div');
            reminder.className = 'rest-reminder';
            reminder.innerHTML = `
                <div class="rest-reminder-content">
                    <div class="rest-reminder-icon">☕</div>
                    <div class="rest-reminder-text">学习提醒</div>
                    <div class="rest-reminder-message">您已连续学习${restTime}分钟，建议休息一下！</div>
                    <button class="rest-reminder-btn" onclick="this.parentElement.parentElement.remove()">知道了</button>
                </div>
            `;
            document.body.appendChild(reminder);
            setTimeout(() => reminder.classList.add('show'), 10);
        }

        function showStartModal() {
            document.getElementById('startModal').classList.add('active');
            document.getElementById('startOptions').style.display = 'flex';
            document.getElementById('timeInputContainer').classList.remove('active');
            document.getElementById('timeInput').value = '';
            document.getElementById('startBtn').style.display = 'none';
            document.getElementById('recordsBtn').style.display = 'none';
            document.getElementById('studyTypeInput').value = '';
            document.getElementById('studyTypeInput').style.display = 'none';
            document.getElementById('studyTypeButtons').dataset.activeType = '';
            isManageMode = false;
            renderStudyTypeButtons();
        }

        function showTimeInput() {
            if (!hasSelectedStudyType()) {
                alert('必须选择一个自习类型');
                return;
            }
            document.getElementById('startOptions').style.display = 'none';
            document.getElementById('timeInputContainer').classList.add('active');
            document.getElementById('timeInput').focus();
        }

        function getSelectedStudyType() {
            const activeBtn = document.querySelector('.study-type-btn.active');
            if (!activeBtn) return '';
            if (activeBtn.dataset.type === 'other') {
                const custom = document.getElementById('studyTypeInput').value.trim();
                const type = custom || '学习其他';
                if (custom) addStudyType(custom);
                return type;
            }
            return activeBtn.dataset.type;
        }

        function hasSelectedStudyType() {
            return !!document.querySelector('.study-type-btn.active');
        }

        function getDefaultStudyTypes() {
            return ['练字', '背单词', '中高考冲刺', '考研冲刺', '智适应训练'];
        }

        function loadStudyTypes() {
            try {
                const saved = localStorage.getItem('studyTypes');
                if (saved) return JSON.parse(saved);
                const legacy = localStorage.getItem('customStudyTypes');
                const custom = legacy ? JSON.parse(legacy) : [];
                const all = [...getDefaultStudyTypes(), ...custom];
                saveStudyTypes(all);
                return all;
            } catch (e) {
                return getDefaultStudyTypes();
            }
        }

        function saveStudyTypes(types) {
            localStorage.setItem('studyTypes', JSON.stringify(types));
        }

        function addStudyType(type) {
            if (!type) return;
            const normalized = type.trim();
            if (!normalized || normalized === '学习其他') return;
            const types = loadStudyTypes();
            if (!types.includes(normalized)) {
                types.push(normalized);
                saveStudyTypes(types);
                renderStudyTypeButtons();
            }
        }

        function deleteStudyType(type) {
            const types = loadStudyTypes().filter(t => t !== type);
            saveStudyTypes(types);
            renderStudyTypeButtons();
            const input = document.getElementById('studyTypeInput');
            if (input.value.trim() === type) {
                input.value = '';
            }
        }

        function moveStudyType(fromType, toBeforeType) {
            const types = loadStudyTypes();
            const fromIndex = types.indexOf(fromType);
            if (fromIndex === -1) return;
            types.splice(fromIndex, 1);
            let toIndex = toBeforeType ? types.indexOf(toBeforeType) : types.length;
            if (toIndex === -1) toIndex = types.length;
            types.splice(toIndex, 0, fromType);
            saveStudyTypes(types);
            renderStudyTypeButtons();
        }

        function escapeHtml(str) {
            return String(str).replace(/[&<>"']/g, m => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[m]);
        }

        let isManageMode = false;

        function renderStudyTypeButtons() {
            const container = document.getElementById('studyTypeButtons');
            const types = loadStudyTypes();
            let html = '';
            types.forEach(type => {
                const safeType = escapeHtml(type);
                if (isManageMode) {
                    html += `
                        <div class="study-type-wrapper">
                            <button class="study-type-btn" data-type="${safeType}" draggable="true">${safeType}</button>
                            <button class="study-type-delete-badge" data-type="${safeType}" title="删除">×</button>
                        </div>
                    `;
                } else {
                    html += `<button class="study-type-btn" data-type="${safeType}" draggable="true">${safeType}</button>`;
                }
            });
            html += '<button class="study-type-btn" data-type="other">学习其他</button>';
            const manageActive = isManageMode ? ' active' : '';
            html += `<button class="study-type-btn study-type-manage${manageActive}" id="studyTypeManageBtn" title="管理类型">⚙️</button>`;
            container.innerHTML = html;

            const activeType = container.dataset.activeType || '';
            if (!activeType) return;
            const activeBtn = container.querySelector(`.study-type-btn[data-type="${CSS.escape(activeType)}"]`);
            if (activeBtn && activeBtn.id !== 'studyTypeManageBtn') activeBtn.classList.add('active');
        }

        function toggleManageMode() {
            isManageMode = !isManageMode;
            isDraggingType = false;
            justDraggedType = false;
            dragTargetType = null;
            renderStudyTypeButtons();
        }

        let isDraggingType = false;
        let justDraggedType = false;
        let longPressTimer = null;
        let dragTargetType = null;
        let dragClone = null;
        let dragStartX = 0;
        let dragStartY = 0;
        const TYPE_LONG_PRESS_DELAY = 500;
        const TYPE_MOVE_THRESHOLD = 10;

        function initStudyTypeDragSort() {
            const container = document.getElementById('studyTypeButtons');

            // 桌面端拖拽排序
            container.addEventListener('dragstart', e => {
                const btn = e.target.closest('.study-type-btn[data-type]');
                if (!btn || btn.id === 'studyTypeManageBtn' || btn.dataset.type === 'other') {
                    e.preventDefault();
                    return;
                }
                isDraggingType = true;
                dragTargetType = btn.dataset.type;
                btn.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', dragTargetType);
            });

            container.addEventListener('dragend', e => {
                const btn = e.target.closest('.study-type-btn[data-type]');
                if (btn) btn.classList.remove('dragging');
                container.querySelectorAll('.study-type-btn').forEach(b => b.classList.remove('drag-over'));
                justDraggedType = true;
                setTimeout(() => {
                    isDraggingType = false;
                    dragTargetType = null;
                    justDraggedType = false;
                }, 300);
            });

            container.addEventListener('dragover', e => {
                e.preventDefault();
                const target = e.target.closest('.study-type-btn[data-type]');
                if (!target || target.id === 'studyTypeManageBtn' || target.dataset.type === 'other' || target.dataset.type === dragTargetType) return;
                container.querySelectorAll('.study-type-btn').forEach(b => b.classList.remove('drag-over'));
                target.classList.add('drag-over');
            });

            container.addEventListener('dragleave', e => {
                const target = e.target.closest('.study-type-btn[data-type]');
                if (target) target.classList.remove('drag-over');
            });

            container.addEventListener('drop', e => {
                e.preventDefault();
                const target = e.target.closest('.study-type-btn[data-type]');
                if (!target || target.id === 'studyTypeManageBtn' || target.dataset.type === 'other') return;
                const fromType = e.dataTransfer.getData('text/plain') || dragTargetType;
                if (fromType && fromType !== target.dataset.type) {
                    moveStudyType(fromType, target.dataset.type);
                }
                container.querySelectorAll('.study-type-btn').forEach(b => b.classList.remove('drag-over'));
                justDraggedType = true;
                isDraggingType = false;
                dragTargetType = null;
                setTimeout(() => { justDraggedType = false; }, 300);
            });

            // 移动端长按拖动
            container.addEventListener('touchstart', e => {
                const btn = e.target.closest('.study-type-btn[data-type]');
                if (!btn || btn.id === 'studyTypeManageBtn' || btn.dataset.type === 'other') return;
                const touch = e.touches[0];
                dragStartX = touch.clientX;
                dragStartY = touch.clientY;
                dragTargetType = btn.dataset.type;
                const startX = touch.clientX;
                const startY = touch.clientY;

                longPressTimer = setTimeout(() => {
                    isDraggingType = true;
                    btn.classList.add('dragging');
                    createStudyTypeDragClone(btn, startX, startY);
                    if (navigator.vibrate) navigator.vibrate(50);
                }, TYPE_LONG_PRESS_DELAY);
            }, { passive: false });

            container.addEventListener('touchmove', e => {
                const touch = e.touches[0];

                if (isDraggingType && dragClone) {
                    e.preventDefault();
                    updateStudyTypeDragClone(touch.clientX, touch.clientY);
                    const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.study-type-btn[data-type]');
                    container.querySelectorAll('.study-type-btn').forEach(b => b.classList.remove('drag-over'));
                    if (target && target.id !== 'studyTypeManageBtn' && target.dataset.type !== 'other' && target.dataset.type !== dragTargetType) {
                        target.classList.add('drag-over');
                    }
                    return;
                }

                if (longPressTimer && (Math.abs(touch.clientX - dragStartX) > TYPE_MOVE_THRESHOLD || Math.abs(touch.clientY - dragStartY) > TYPE_MOVE_THRESHOLD)) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            }, { passive: false });

            container.addEventListener('touchend', e => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }

                if (isDraggingType && dragClone) {
                    const touch = e.changedTouches[0];
                    const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.study-type-btn[data-type]');
                    if (target && target.dataset.type && target.dataset.type !== dragTargetType && target.dataset.type !== 'other' && target.id !== 'studyTypeManageBtn') {
                        moveStudyType(dragTargetType, target.dataset.type);
                    }
                    cleanupStudyTypeDragClone();
                    justDraggedType = true;
                    setTimeout(() => {
                        isDraggingType = false;
                        dragTargetType = null;
                        justDraggedType = false;
                    }, 500);
                }
            });

            container.addEventListener('touchcancel', () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                cleanupStudyTypeDragClone();
                isDraggingType = false;
                dragTargetType = null;
            });
        }

        function createStudyTypeDragClone(btn, x, y) {
            dragClone = btn.cloneNode(true);
            const rect = btn.getBoundingClientRect();
            dragClone.style.position = 'fixed';
            dragClone.style.left = rect.left + 'px';
            dragClone.style.top = rect.top + 'px';
            dragClone.style.width = rect.width + 'px';
            dragClone.style.height = rect.height + 'px';
            dragClone.style.zIndex = '10000';
            dragClone.style.pointerEvents = 'none';
            dragClone.style.opacity = '0.9';
            dragClone.classList.add('dragging');
            document.body.appendChild(dragClone);
        }

        function updateStudyTypeDragClone(x, y) {
            if (!dragClone) return;
            const rect = dragClone.getBoundingClientRect();
            dragClone.style.left = (x - rect.width / 2) + 'px';
            dragClone.style.top = (y - rect.height / 2) + 'px';
        }

        function cleanupStudyTypeDragClone() {
            if (dragClone) {
                dragClone.remove();
                dragClone = null;
            }
            const container = document.getElementById('studyTypeButtons');
            container.querySelectorAll('.study-type-btn').forEach(b => {
                b.classList.remove('dragging');
                b.classList.remove('drag-over');
            });
        }

        function startStudy(time) {
            if (!hasSelectedStudyType()) {
                alert('必须选择一个自习类型');
                return;
            }
            currentStudyType = getSelectedStudyType();
            isStudying = true;
            studyStartTime = Date.now();
            studyDuration = 0;
            totalPauseTime = 0;
            lastRestReminderMinute = 0;
            targetTime = time;
            isPaused = false;
            pauseStartTime = 0;

            document.getElementById('startModal').classList.remove('active');
            document.getElementById('startBtn').style.display = 'none';
            document.getElementById('recordsBtn').style.display = 'none';
            document.getElementById('stopBtn').classList.add('visible');
            document.getElementById('breakBtn').classList.add('visible');
            document.getElementById('studyDisplay').style.display = 'block';
            if (currentSoundIndex === 0 || currentSoundIndex === 5) {
                addDisplayRain();
            }

            const studyBg = document.getElementById('studyBg');
            // 不再自动切换灯光，保留当前灯光状态

            const bgOverlay = document.getElementById('bgOverlay');
            bgOverlay.classList.remove('active');
            bgOverlay.style.opacity = '';
            bgOverlay.style.transition = '';

            document.getElementById('breakBtn').innerHTML = '⏸️ 课间休息';
            document.getElementById('breakBtn').classList.remove('paused');

            if (targetTime > 0) {
                document.getElementById('studyStatus').innerHTML = `目标: ${formatTime(targetTime)}`;
            } else {
                document.getElementById('studyStatus').textContent = '';
            }

            timerInterval = setInterval(updateStudyTime, 1000);
            startWakeLockTimer();
            
            saveStudyState();
        }

        function startStudyWithTime() {
            const minutes = parseFloat(document.getElementById('timeInput').value);
            if (isNaN(minutes) || minutes <= 0) {
                alert('请输入有效的时间（大于0）');
                return;
            }
            startStudy(Math.round(minutes * 60));
        }

        function stopStudy() {
            if (!isStudying) return;
            document.getElementById('stopConfirmMessage').textContent = `本次自习时长: ${formatTime(studyDuration, false)}`;
            document.getElementById('stopConfirmModal').classList.add('active');
        }

        function confirmStopStudy() {
            closeModal('stopConfirmModal');
            executeStopStudy();
        }

        function cancelStopStudy() {
            closeModal('stopConfirmModal');
        }

        function executeStopStudy() {
            if (!isStudying) return;

            isStudying = false;
            clearInterval(timerInterval);
            clearInterval(breakTimerInterval);
            stopBeepAlarm();
            document.getElementById('breakBoard').classList.remove('show');

            const record = {
                id: Date.now(),
                date: new Date(studyStartTime).toLocaleDateString('zh-CN'),
                startTime: new Date(studyStartTime).toLocaleTimeString('zh-CN'),
                endTime: new Date().toLocaleTimeString('zh-CN'),
                duration: studyDuration,
                studyType: currentStudyType || '未分类'
            };

            records.push(record);
            saveRecords();
            localStorage.removeItem('studyState');

            document.getElementById('stopBtn').classList.remove('visible');
            document.getElementById('breakBtn').classList.remove('visible');
            document.getElementById('startBtn').style.display = 'block';
            document.getElementById('recordsBtn').style.display = 'block';
            document.getElementById('studyDisplay').style.display = 'none';
            document.getElementById('fullscreenBtn').style.display = 'flex';

            const bgOverlay = document.getElementById('bgOverlay');
            const studyBg = document.getElementById('studyBg');

            // 不再自动切换灯光，保留当前灯光状态

            if (currentSoundIndex !== -1) {
                fadeAudioOut(() => {
                    document.getElementById('bgMusic').pause();
                    document.getElementById('bgMusic').currentTime = 0;
                });
                currentSoundIndex = -1;
                localStorage.setItem('currentSoundIndex', '-1');
                clearSoundButtonStyle();
            }

            removeRaindrops();
            removeFireEffects();
            removeBonfire();
            removeCloudEffects();
            removeDisplayRain();
            stopWakeLock();
        }

        let isPaused = false;
        let pauseStartTime = 0;
        let totalPauseTime = 0;
        let lastRestReminderMinute = 0;
        let breakTimerInterval = null;
        let breakCountdownInterval = null;
        let breakCountdownEndTime = 0;
        let breakCountdownDuration = 0;

        function updateBreakTime() {
            const breakSeconds = Math.floor((Date.now() - pauseStartTime) / 1000);
            const minutes = String(Math.floor(breakSeconds / 60)).padStart(2, '0');
            const seconds = String(breakSeconds % 60).padStart(2, '0');
            document.getElementById('breakTime').textContent = `${minutes}:${seconds}`;
        }

        function startBreakCountdown(minutes) {
            breakCountdownDuration = Math.max(1, Math.round(minutes * 60));
            breakCountdownEndTime = Date.now() + breakCountdownDuration * 1000;

            const options = document.getElementById('breakOptions');
            const countdown = document.getElementById('breakCountdown');
            const countdownTime = document.getElementById('breakCountdownTime');
            const hint = document.getElementById('breakHint');

            options.style.display = 'none';
            countdown.style.display = 'block';
            hint.textContent = '时间到会自动提醒，也可点击「继续自习」提前返回';

            updateBreakCountdown();
            breakCountdownInterval = setInterval(updateBreakCountdown, 1000);
        }

        function updateBreakCountdown() {
            const now = Date.now();
            let remain = Math.max(0, Math.ceil((breakCountdownEndTime - now) / 1000));
            const minutes = String(Math.floor(remain / 60)).padStart(2, '0');
            const seconds = String(remain % 60).padStart(2, '0');

            const countdownTime = document.getElementById('breakCountdownTime');
            countdownTime.textContent = `${minutes}:${seconds}`;

            if (remain <= 30) {
                countdownTime.classList.add('warning');
            } else {
                countdownTime.classList.remove('warning');
            }

            if (remain === 0) {
                clearInterval(breakCountdownInterval);
                onBreakTimeUp();
            }
        }

        let beepAlarmNodes = null;
        let beepAlarmTimeout = null;

        function stopBeepAlarm() {
            if (beepAlarmNodes) {
                try {
                    beepAlarmNodes.gain.gain.cancelScheduledValues(beepAlarmNodes.ctx.currentTime);
                    beepAlarmNodes.gain.gain.setValueAtTime(beepAlarmNodes.gain.gain.value, beepAlarmNodes.ctx.currentTime);
                    beepAlarmNodes.gain.gain.exponentialRampToValueAtTime(0.001, beepAlarmNodes.ctx.currentTime + 0.2);
                    setTimeout(() => {
                        beepAlarmNodes.osc.disconnect();
                        beepAlarmNodes.gain.disconnect();
                        beepAlarmNodes = null;
                    }, 250);
                } catch (e) {
                    beepAlarmNodes = null;
                }
            }
            if (beepAlarmTimeout) {
                clearTimeout(beepAlarmTimeout);
                beepAlarmTimeout = null;
            }
        }

        function playBeepBeepBeep(duration = 10) {
            stopBeepAlarm();
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const ctx = new AudioContext();
                const masterGain = ctx.createGain();
                masterGain.connect(ctx.destination);
                masterGain.gain.setValueAtTime(0.12, ctx.currentTime);

                const beepDuration = 0.12;
                const gap = 0.12;
                const cycle = beepDuration + gap;
                const totalCycles = Math.floor(duration / cycle);

                for (let i = 0; i < totalCycles; i++) {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(masterGain);

                    const start = ctx.currentTime + i * cycle;
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(880, start);
                    gain.gain.setValueAtTime(0, start);
                    gain.gain.linearRampToValueAtTime(1, start + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, start + beepDuration);
                    osc.start(start);
                    osc.stop(start + beepDuration);
                }

                beepAlarmNodes = { ctx, osc: masterGain, gain: masterGain };
                beepAlarmTimeout = setTimeout(() => {
                    stopBeepAlarm();
                }, duration * 1000 + 500);
            } catch (e) {
                // 不支持的浏览器静默失败
            }
        }

        function onBreakTimeUp() {
            const hint = document.getElementById('breakHint');
            hint.textContent = '⏰ 课间休息时间到了！点击「继续自习」返回学习';
            hint.style.color = '#fbbf24';
            playBeepBeepBeep();
        }

        function resetBreakBoard() {
            clearInterval(breakCountdownInterval);
            document.getElementById('breakOptions').style.display = 'flex';
            document.getElementById('breakCountdown').style.display = 'none';
            document.getElementById('breakCountdownTime').classList.remove('warning');
            document.getElementById('breakHint').textContent = '点击「继续自习」返回学习';
            document.getElementById('breakHint').style.color = 'rgba(255, 255, 255, 0.6)';
            document.querySelectorAll('.break-option-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById('breakCustomInput').value = '';
        }

        function toggleBreak() {
            const breakBtn = document.getElementById('breakBtn');
            const bgMusic = document.getElementById('bgMusic');
            const breakBoard = document.getElementById('breakBoard');
            const bgOverlay = document.getElementById('bgOverlay');
            
            if (!isPaused) {
                isPaused = true;
                pauseStartTime = Date.now();
                clearInterval(timerInterval);
                if (currentSoundIndex !== -1) {
                    bgMusic.pause();
                }
                breakBtn.innerHTML = '▶️ 继续自习';
                breakBtn.classList.add('paused');
                document.getElementById('studyStatus').textContent = '课间休息中...';
                
                // 不再自动切换灯光，保留当前灯光状态
                
                breakBoard.classList.add('show');
                document.getElementById('breakTime').textContent = '00:00';
                breakTimerInterval = setInterval(updateBreakTime, 1000);
            } else {
                isPaused = false;
                const pauseDuration = Date.now() - pauseStartTime;
                totalPauseTime += pauseDuration;
                if (pauseDuration > 5 * 60 * 1000) {
                    lastRestReminderMinute = 0;
                }
                breakBtn.innerHTML = '⏸️ 课间休息';
                breakBtn.classList.remove('paused');
                document.getElementById('studyStatus').textContent = '';
                timerInterval = setInterval(updateStudyTime, 1000);
                if (currentSoundIndex !== -1) {
                    bgMusic.play();
                }
                
                // 不再自动切换灯光，保留当前灯光状态
                
                stopBeepAlarm();

                breakBoard.classList.remove('show');
                clearInterval(breakTimerInterval);
                resetBreakBoard();
            }
            saveStudyState();
        }

        function showRecords() {
            loadRecords();

            const totalDuration = records.reduce((sum, record) => sum + record.duration, 0);
            document.getElementById('totalTime').innerHTML = `总自习时长: ${formatTime(totalDuration)}`;

            showAllDays = false;
            document.getElementById('chartsContainer').style.display = 'flex';
            document.getElementById('lineChartContainer').style.display = 'none';

            pieChartDate = new Date();

            const recordsList = document.getElementById('recordsList');
            recordsList.innerHTML = '';

            if (records.length === 0) {
                recordsList.innerHTML = '<div class="no-records">暂无自习记录</div>';
            } else {
                const groupedRecords = groupRecordsByTime(records);
                renderGroupedRecords(groupedRecords, recordsList);
            }

            document.getElementById('recordsModal').classList.add('active');
            document.getElementById('startBtn').style.display = 'none';
            document.getElementById('recordsBtn').style.display = 'none';

            // 重置滚动位置
            const recordsContent = document.querySelector('#recordsModal .records-content');
            if (recordsContent) recordsContent.scrollTop = 0;

            requestAnimationFrame(() => {
                drawHourChart(true);
                drawDayChart(true);
                drawPieChart(true);
            });
        }

        function groupRecordsByTime(records) {
            const now = new Date();
            const today = now.toLocaleDateString('zh-CN');
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

            const sortedRecords = [...records].sort((a, b) => {
                const dateCompare = b.date.localeCompare(a.date);
                if (dateCompare !== 0) return dateCompare;
                return b.startTime.localeCompare(a.startTime);
            });

            const groups = {
                today: [],
                recentDays: {},
                recentMonths: {},
                years: {}
            };

            sortedRecords.forEach(record => {
                const recordDate = new Date(record.date.replace(/\//g, '-'));
                
                if (record.date === today) {
                    groups.today.push(record);
                } else if (recordDate >= thirtyDaysAgo) {
                    if (!groups.recentDays[record.date]) {
                        groups.recentDays[record.date] = [];
                    }
                    groups.recentDays[record.date].push(record);
                } else if (recordDate >= oneYearAgo) {
                    const monthKey = record.date.substring(0, 7);
                    if (!groups.recentMonths[monthKey]) {
                        groups.recentMonths[monthKey] = {};
                    }
                    if (!groups.recentMonths[monthKey][record.date]) {
                        groups.recentMonths[monthKey][record.date] = [];
                    }
                    groups.recentMonths[monthKey][record.date].push(record);
                } else {
                    const yearKey = record.date.substring(0, 4);
                    if (!groups.years[yearKey]) {
                        groups.years[yearKey] = {};
                    }
                    const monthKey = record.date.substring(0, 7);
                    if (!groups.years[yearKey][monthKey]) {
                        groups.years[yearKey][monthKey] = {};
                    }
                    if (!groups.years[yearKey][monthKey][record.date]) {
                        groups.years[yearKey][monthKey][record.date] = [];
                    }
                    groups.years[yearKey][monthKey][record.date].push(record);
                }
            });

            return groups;
        }

        function renderGroupedRecords(groups, container) {
            if (groups.today.length > 0) {
                const todayDiv = document.createElement('div');
                todayDiv.className = 'time-group';
                
                const header = document.createElement('div');
                header.className = 'time-group-header';
                header.innerHTML = `📅 今天 <span class="group-count">${groups.today.length}条</span>`;
                todayDiv.appendChild(header);
                
                const content = document.createElement('div');
                content.className = 'time-group-content';
                renderDayRecords(groups.today, content);
                todayDiv.appendChild(content);
                
                container.appendChild(todayDiv);
            }

            if (Object.keys(groups.recentDays).length > 0) {
                Object.keys(groups.recentDays).forEach(date => {
                    const dayDiv = document.createElement('div');
                    dayDiv.className = 'time-group collapsible';
                    
                    const header = document.createElement('div');
                    header.className = 'time-group-header';
                    const dayRecords = groups.recentDays[date];
                    const dayDuration = dayRecords.reduce((sum, r) => sum + r.duration, 0);
                    header.innerHTML = `📅 ${date} <span class="group-count">${dayRecords.length}条 | ${formatTime(dayDuration, false)}</span> <span class="expand-icon">▼</span>`;
                    dayDiv.appendChild(header);
                    
                    const content = document.createElement('div');
                    content.className = 'time-group-content';
                    renderDayRecords(dayRecords, content);
                    dayDiv.appendChild(content);
                    
                    header.addEventListener('click', () => toggleCollapse(dayDiv));
                    container.appendChild(dayDiv);
                });
            }

            if (Object.keys(groups.recentMonths).length > 0) {
                Object.keys(groups.recentMonths).reverse().forEach(month => {
                    const monthDiv = document.createElement('div');
                    monthDiv.className = 'time-group collapsible';
                    
                    const header = document.createElement('div');
                    header.className = 'time-group-header';
                    const monthData = groups.recentMonths[month];
                    let monthDuration = 0;
                    let monthCount = 0;
                    Object.values(monthData).forEach(dayRecords => {
                        monthDuration += dayRecords.reduce((sum, r) => sum + r.duration, 0);
                        monthCount += dayRecords.length;
                    });
                    header.innerHTML = `📆 ${month}月 <span class="group-count">${monthCount}条 | ${formatTime(monthDuration, false)}</span> <span class="expand-icon">▼</span>`;
                    monthDiv.appendChild(header);
                    
                    const content = document.createElement('div');
                    content.className = 'time-group-content month-content';
                    
                    Object.keys(monthData).forEach(date => {
                        const dayDiv = document.createElement('div');
                        dayDiv.className = 'time-group collapsible';
                        
                        const dayHeader = document.createElement('div');
                        dayHeader.className = 'time-group-header day-header';
                        const dayRecords = monthData[date];
                        const dayDuration = dayRecords.reduce((sum, r) => sum + r.duration, 0);
                        dayHeader.innerHTML = `  └─ ${date} <span class="group-count">${dayRecords.length}条 | ${formatTime(dayDuration, false)}</span> <span class="expand-icon">▼</span>`;
                        dayDiv.appendChild(dayHeader);
                        
                        const dayContent = document.createElement('div');
                        dayContent.className = 'time-group-content';
                        renderDayRecords(dayRecords, dayContent);
                        dayDiv.appendChild(dayContent);
                        
                        dayHeader.addEventListener('click', () => toggleCollapse(dayDiv));
                        content.appendChild(dayDiv);
                    });
                    
                    monthDiv.appendChild(content);
                    header.addEventListener('click', () => toggleCollapse(monthDiv));
                    container.appendChild(monthDiv);
                });
            }

            if (Object.keys(groups.years).length > 0) {
                Object.keys(groups.years).reverse().forEach(year => {
                    const yearDiv = document.createElement('div');
                    yearDiv.className = 'time-group collapsible';
                    
                    const header = document.createElement('div');
                    header.className = 'time-group-header';
                    const yearData = groups.years[year];
                    let yearDuration = 0;
                    let yearCount = 0;
                    Object.values(yearData).forEach(monthData => {
                        Object.values(monthData).forEach(dayRecords => {
                            yearDuration += dayRecords.reduce((sum, r) => sum + r.duration, 0);
                            yearCount += dayRecords.length;
                        });
                    });
                    header.innerHTML = `📅 ${year}年 <span class="group-count">${yearCount}条 | ${formatTime(yearDuration, false)}</span> <span class="expand-icon">▼</span>`;
                    yearDiv.appendChild(header);
                    
                    const content = document.createElement('div');
                    content.className = 'time-group-content year-content';
                    
                    Object.keys(yearData).reverse().forEach(month => {
                        const monthDiv = document.createElement('div');
                        monthDiv.className = 'time-group collapsible';
                        
                        const monthHeader = document.createElement('div');
                        monthHeader.className = 'time-group-header month-header';
                        const monthData = yearData[month];
                        let monthDuration = 0;
                        let monthCount = 0;
                        Object.values(monthData).forEach(dayRecords => {
                            monthDuration += dayRecords.reduce((sum, r) => sum + r.duration, 0);
                            monthCount += dayRecords.length;
                        });
                        monthHeader.innerHTML = `  └─ ${month}月 <span class="group-count">${monthCount}条 | ${formatTime(monthDuration, false)}</span> <span class="expand-icon">▼</span>`;
                        monthDiv.appendChild(monthHeader);
                        
                        const monthContent = document.createElement('div');
                        monthContent.className = 'time-group-content month-content';
                        
                        Object.keys(monthData).forEach(date => {
                            const dayDiv = document.createElement('div');
                            dayDiv.className = 'time-group collapsible';
                            
                            const dayHeader = document.createElement('div');
                            dayHeader.className = 'time-group-header day-header';
                            const dayRecords = monthData[date];
                            const dayDuration = dayRecords.reduce((sum, r) => sum + r.duration, 0);
                            dayHeader.innerHTML = `    └─ ${date} <span class="group-count">${dayRecords.length}条 | ${formatTime(dayDuration, false)}</span> <span class="expand-icon">▼</span>`;
                            dayDiv.appendChild(dayHeader);
                            
                            const dayContent = document.createElement('div');
                            dayContent.className = 'time-group-content';
                            renderDayRecords(dayRecords, dayContent);
                            dayDiv.appendChild(dayContent);
                            
                            dayHeader.addEventListener('click', () => toggleCollapse(dayDiv));
                            monthContent.appendChild(dayDiv);
                        });
                        
                        monthDiv.appendChild(monthContent);
                        monthHeader.addEventListener('click', () => toggleCollapse(monthDiv));
                        content.appendChild(monthDiv);
                    });
                    
                    yearDiv.appendChild(content);
                    header.addEventListener('click', () => toggleCollapse(yearDiv));
                    container.appendChild(yearDiv);
                });
            }
        }

        function renderDayRecords(dayRecords, container) {
            const mergedRecords = mergeShortRecordsForDay(dayRecords);
            mergedRecords.forEach((group) => {
                const item = document.createElement('div');
                item.className = 'record-item';
                
                if (group.length > 1) {
                    const firstRecord = group[0];
                    const lastRecord = group[group.length - 1];
                    const totalDuration = group.reduce((sum, r) => sum + r.duration, 0);
                    
                    item.innerHTML = `
                        <div class="record-details">${firstRecord.startTime} - ${lastRecord.endTime} | 总时长: ${formatTime(totalDuration, false)} <span class="expand-icon">▼</span></div>
                        <div class="record-subitems" style="display: none;">
                            ${group.map((r, i) => `<div class="record-subitem">${i + 1}. ${r.startTime} - ${r.endTime} | ${formatTime(r.duration, false)}${r.studyType ? ' | ' + r.studyType : ''}</div>`).join('')}
                        </div>
                        <button class="delete-btn" onclick="deleteRecords([${group.map(r => r.id).join(',')}])">🗑️</button>
                    `;
                    
                    item.querySelector('.record-details').addEventListener('click', () => {
                        const subitems = item.querySelector('.record-subitems');
                        const icon = item.querySelector('.expand-icon');
                        if (subitems.style.display === 'none') {
                            subitems.style.display = 'block';
                            icon.textContent = '▲';
                        } else {
                            subitems.style.display = 'none';
                            icon.textContent = '▼';
                        }
                    });
                } else {
                    const record = group[0];
                    item.innerHTML = `
                        <div class="record-details">${record.startTime} - ${record.endTime} | 时长: ${formatTime(record.duration, false)}${record.studyType ? ' | ' + record.studyType : ''}</div>
                        <button class="delete-btn" onclick="deleteRecords([${record.id}])">🗑️</button>
                    `;
                }
                
                container.appendChild(item);
            });
        }

        function deleteRecords(recordIds) {
            if (confirm('确定要将这些记录移到回收站吗？')) {
                const deletedRecords = records.filter(r => recordIds.includes(r.id));
                records = records.filter(r => !recordIds.includes(r.id));
                saveRecords();
                
                const trashRecords = JSON.parse(localStorage.getItem('trashRecords') || '[]');
                deletedRecords.forEach(r => {
                    r.deletedAt = Date.now();
                });
                localStorage.setItem('trashRecords', JSON.stringify([...trashRecords, ...deletedRecords]));
                
                showRecords();
            }
        }

        function showTrashModal() {
            const trashRecords = JSON.parse(localStorage.getItem('trashRecords') || '[]');
            const trashList = document.getElementById('trashList');
            trashList.innerHTML = '';
            
            if (trashRecords.length === 0) {
                trashList.innerHTML = '<div class="no-records">回收站为空</div>';
            } else {
                trashRecords.forEach((record, index) => {
                    const item = document.createElement('div');
                    item.className = 'record-item';
                    item.innerHTML = `
                        <div class="record-details">${record.date} ${record.startTime} - ${record.endTime} | ${formatTime(record.duration, false)}${record.studyType ? ' | ' + record.studyType : ''}</div>
                        <div class="trash-actions">
                            <button class="restore-btn" onclick="restoreRecord(${index})">🔄 恢复</button>
                        </div>
                    `;
                    trashList.appendChild(item);
                });
            }
            
            document.getElementById('trashModal').classList.add('active');
            document.getElementById('startBtn').style.display = 'none';
            document.getElementById('recordsBtn').style.display = 'none';
        }

        function restoreRecord(index) {
            const trashRecords = JSON.parse(localStorage.getItem('trashRecords') || '[]');
            const record = trashRecords.splice(index, 1)[0];
            delete record.deletedAt;
            records.push(record);
            saveRecords();
            localStorage.setItem('trashRecords', JSON.stringify(trashRecords));
            showTrashModal();
        }

        function emptyTrash() {
            if (confirm('确定要清空回收站吗？此操作不可恢复！')) {
                localStorage.removeItem('trashRecords');
                showTrashModal();
            }
        }

        function mergeShortRecordsForDay(dayRecords) {
            if (dayRecords.length === 0) return [];

            const sorted = [...dayRecords].sort((a, b) => a.startTime.localeCompare(b.startTime));
            const merged = [];
            let currentGroup = [sorted[0]];

            for (let i = 1; i < sorted.length; i++) {
                const current = sorted[i];
                const last = currentGroup[currentGroup.length - 1];
                if (current.duration < 600 && last.duration < 600) {
                    currentGroup.push(current);
                } else {
                    merged.push(currentGroup);
                    currentGroup = [current];
                }
            }
            merged.push(currentGroup);
            return merged;
        }

        function toggleCollapse(element) {
            const content = element.querySelector('.time-group-content');
            const icon = element.querySelector('.expand-icon');
            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.textContent = '▲';
            } else {
                content.style.display = 'none';
                icon.textContent = '▼';
            }
        }

        const STUDY_TYPE_COLORS = {
            '练字': '#f87171',
            '背单词': '#60a5fa',
            '学习其他': '#fbbf24',
            '未分类': '#94a3b8'
        };

        function getStudyTypeColor(type) {
            if (STUDY_TYPE_COLORS[type]) return STUDY_TYPE_COLORS[type];
            let hash = 0;
            for (let i = 0; i < type.length; i++) {
                hash = type.charCodeAt(i) + ((hash << 5) - hash);
            }
            const hue = Math.abs(hash % 360);
            return `hsl(${hue}, 70%, 65%)`;
        }

        function easeOutBack(t) {
            const c1 = 1.70158;
            const c3 = c1 + 1;
            return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        }

        function triggerPieWrapperAnimation() {
            const wrapper = document.querySelector('.pie-chart-wrapper');
            if (wrapper) {
                wrapper.classList.remove('animating');
                void wrapper.offsetWidth;
                wrapper.classList.add('animating');
            }
        }

        function renderPieCanvas(dateLabel) {
            const canvas = document.getElementById('pieChart');
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            const size = 180;

            canvas.width = size * dpr;
            canvas.height = size * dpr;
            canvas.style.width = size + 'px';
            canvas.style.height = size + 'px';
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, size, size);

            const progress = pieChartAnimProgress;

            if (pieChartCurrentEmpty) {
                ctx.globalAlpha = Math.min(1, progress * 1.5);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.font = '14px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`${dateLabel}暂无记录`, size / 2, size / 2 + 5);
                ctx.globalAlpha = 1;
                return;
            }

            const centerX = size / 2;
            const centerY = size / 2;
            const finalRadius = size * 0.38;
            const radius = finalRadius * progress;

            const totalSweep = progress * Math.PI * 2;
            let startAngle = -Math.PI / 2;

            ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
            ctx.shadowBlur = 20 * progress;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 10 * progress;

            pieChartCurrentData.forEach(slice => {
                const sliceAngle = slice.percent * totalSweep;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
                ctx.closePath();
                ctx.fillStyle = slice.color;
                ctx.fill();

                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(20, 25, 40, 0.9)';
                ctx.stroke();

                if (progress > 0.7) {
                    const midAngle = startAngle + sliceAngle / 2;
                    const labelRadius = radius * 0.65;
                    const lx = centerX + Math.cos(midAngle) * labelRadius;
                    const ly = centerY + Math.sin(midAngle) * labelRadius;
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    ctx.font = 'bold 11px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const pct = Math.round(slice.percent * 100);
                    if (pct >= 8) {
                        ctx.globalAlpha = (progress - 0.7) / 0.3;
                        ctx.fillText(pct + '%', lx, ly);
                        ctx.globalAlpha = 1;
                    }
                }

                startAngle += sliceAngle;
            });

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * 0.35, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(20, 25, 40, 0.95)';
            ctx.fill();
        }

        function renderPieLegend(data, animate) {
            const legend = document.getElementById('pieChartLegend');
            const itemClass = animate ? 'pie-legend-item animating' : 'pie-legend-item';
            legend.innerHTML = data.map((slice, i) => `
                <div class="${itemClass}" style="${animate ? `animation-delay: ${0.35 + i * 0.08}s` : ''}">
                    <div class="pie-legend-color" style="background:${slice.color}"></div>
                    <span>${slice.type} · ${formatTime(slice.duration, false)} · ${Math.round(slice.percent * 100)}%</span>
                </div>
            `).join('');
        }

        function startPieChartAnimation(dateLabel) {
            if (pieChartAnimId) cancelAnimationFrame(pieChartAnimId);
            pieChartAnimProgress = 0;
            triggerPieWrapperAnimation();

            const start = performance.now();
            const duration = 800;

            function step(now) {
                const elapsed = now - start;
                pieChartAnimProgress = Math.min(1, elapsed / duration);
                pieChartAnimProgress = easeOutBack(pieChartAnimProgress);
                renderPieCanvas(dateLabel);

                if (elapsed < duration) {
                    pieChartAnimId = requestAnimationFrame(step);
                } else {
                    pieChartAnimProgress = 1;
                    renderPieCanvas(dateLabel);
                    updatePieNavButtons();
                }
            }

            pieChartAnimId = requestAnimationFrame(step);
        }

        function drawPieChart(animate = false) {
            const title = document.getElementById('pieChartTitle');
            const dateStr = pieChartDate.toLocaleDateString('zh-CN');
            const todayStr = new Date().toLocaleDateString('zh-CN');
            const isToday = dateStr === todayStr;
            const dateLabel = isToday ? '今日' : `${pieChartDate.getFullYear()}年${pieChartDate.getMonth() + 1}月${pieChartDate.getDate()}日`;
            if (title) title.textContent = `${dateLabel}自习类型占比`;

            const dayRecords = records.filter(r => r.date === dateStr);

            if (dayRecords.length === 0) {
                pieChartCurrentData = null;
                pieChartCurrentEmpty = true;
                document.getElementById('pieChartLegend').innerHTML = '';
                updatePieNavButtons();

                if (animate) {
                    startPieChartAnimation(dateLabel);
                } else {
                    if (pieChartAnimId) {
                        cancelAnimationFrame(pieChartAnimId);
                        pieChartAnimId = null;
                    }
                    pieChartAnimProgress = 1;
                    renderPieCanvas(dateLabel);
                }
                return;
            }

            const typeMap = {};
            dayRecords.forEach(r => {
                const rawType = r.studyType || '未分类';
                const category = getEntryCategory(rawType);
                typeMap[category] = (typeMap[category] || 0) + r.duration;
            });

            const total = dayRecords.reduce((sum, r) => sum + r.duration, 0);
            const data = Object.entries(typeMap).map(([type, duration]) => ({
                type,
                duration,
                percent: duration / total,
                color: getStudyTypeColor(type)
            })).sort((a, b) => b.duration - a.duration);

            pieChartCurrentData = data;
            pieChartCurrentEmpty = false;

            if (animate) {
                renderPieLegend(data, true);
                startPieChartAnimation(dateLabel);
            } else {
                if (pieChartAnimId) {
                    cancelAnimationFrame(pieChartAnimId);
                    pieChartAnimId = null;
                }
                pieChartAnimProgress = 1;
                renderPieCanvas(dateLabel);
                renderPieLegend(data, false);
                updatePieNavButtons();
            }
        }

        function getDateOnly(date) {
            return new Date(date.getFullYear(), date.getMonth(), date.getDate());
        }

        function parseRecordDate(dateStr) {
            const parts = dateStr.split('/');
            if (parts.length !== 3) return new Date(dateStr);
            const [y, m, d] = parts.map(Number);
            return new Date(y, m - 1, d);
        }

        function prevPieDay() {
            pieChartDate.setDate(pieChartDate.getDate() - 1);
            drawPieChart(true);
        }

        function nextPieDay() {
            const today = getDateOnly(new Date());
            const current = getDateOnly(pieChartDate);
            if (current.getTime() < today.getTime()) {
                pieChartDate.setDate(pieChartDate.getDate() + 1);
                drawPieChart(true);
            }
        }

        function updatePieNavButtons() {
            const prevBtn = document.getElementById('piePrevBtn');
            const nextBtn = document.getElementById('pieNextBtn');
            if (!prevBtn || !nextBtn) return;

            const today = getDateOnly(new Date());
            const current = getDateOnly(pieChartDate);

            nextBtn.disabled = current.getTime() >= today.getTime();

            const hasEarlierRecords = records.some(r => {
                const rDate = parseRecordDate(r.date);
                return rDate.getTime() < current.getTime();
            });
            prevBtn.disabled = !hasEarlierRecords;
        }

        function ensureChartArea(chart) {
            if (chart.parentNode.classList.contains('chart-area')) {
                return chart.parentNode;
            }
            const area = document.createElement('div');
            area.className = 'chart-area';
            chart.parentNode.insertBefore(area, chart);
            area.appendChild(chart);
            return area;
        }

        function updateYAxis(area, maxMinutes, animate = false) {
            let yAxis = area.querySelector('.chart-y-axis');
            if (!yAxis) {
                yAxis = document.createElement('div');
                yAxis.className = 'chart-y-axis';
                area.appendChild(yAxis);
            }
            yAxis.innerHTML = '';
            yAxis.className = animate ? 'chart-y-axis animating' : 'chart-y-axis';
            const steps = [maxMinutes, Math.round(maxMinutes * 3 / 4), Math.round(maxMinutes / 2), Math.round(maxMinutes / 4), 0];
            steps.forEach(v => {
                const tick = document.createElement('div');
                tick.textContent = formatHM(v);
                yAxis.appendChild(tick);
            });
        }

        function drawHourChart(animate = false) {
            const today = new Date().toLocaleDateString('zh-CN');
            const todayRecords = records.filter(r => r.date === today);

            const hourMinutes = new Array(24).fill(0);

            todayRecords.forEach(record => {
                const startHour = parseInt(record.startTime.split(':')[0]);
                const startMin = parseInt(record.startTime.split(':')[1]);
                const endHour = parseInt(record.endTime.split(':')[0]);
                const endMin = parseInt(record.endTime.split(':')[1]);

                const actualDuration = record.duration;
                const totalMinutes = (endHour - startHour) * 60 + endMin - startMin;

                if (totalMinutes <= 0) return;

                const efficiency = actualDuration / 60 / totalMinutes;

                if (startHour === endHour) {
                    hourMinutes[startHour] += Math.round((endMin - startMin) * efficiency);
                } else {
                    hourMinutes[startHour] += Math.round((60 - startMin) * efficiency);
                    for (let h = startHour + 1; h < endHour; h++) {
                        hourMinutes[h] += Math.round(60 * efficiency);
                    }
                    hourMinutes[endHour] += Math.round(endMin * efficiency);
                }
            });

            const maxMinutes = Math.max(...hourMinutes, 1);
            const chart = document.getElementById('hourChart');
            const area = ensureChartArea(chart);
            chart.innerHTML = '';

            if (animate) {
                area.classList.remove('animating');
                void area.offsetWidth;
                area.classList.add('animating');
            }

            for (let i = 0; i < 24; i++) {
                const height = (hourMinutes[i] / maxMinutes) * 100;
                const bar = document.createElement('div');
                bar.className = animate ? 'hour-bar animating' : 'hour-bar';
                if (animate) bar.style.animationDelay = `${i * 0.02}s`;
                bar.style.height = `${Math.max(height, 2)}%`;
                bar.title = `${i}:00 - ${formatHM(hourMinutes[i])}`;
                chart.appendChild(bar);
            }

            updateYAxis(area, maxMinutes, animate);

            const existingHourLabels = area.querySelector('.hour-labels');
            if (existingHourLabels) {
                existingHourLabels.remove();
            }

            const labels = document.createElement('div');
            labels.className = animate ? 'hour-labels animating' : 'hour-labels';
            for (let i = 0; i < 24; i += 2) {
                const label = document.createElement('div');
                label.className = 'hour-label';
                label.textContent = i;
                labels.appendChild(label);
            }
            area.appendChild(labels);
        }

        function drawDayChart(animate = false) {
            const dayMinutes = [];
            const dayLabels = [];

            for (let i = 5; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toLocaleDateString('zh-CN');
                dayLabels.push(dateStr.split('/').slice(1).join('/'));

                const dayRecords = records.filter(r => r.date === dateStr);
                const totalMinutes = dayRecords.reduce((sum, r) => sum + Math.floor(r.duration / 60), 0);
                dayMinutes.push(totalMinutes);
            }

            const maxMinutes = Math.max(...dayMinutes, 1);
            const chart = document.getElementById('dayChart');
            const area = ensureChartArea(chart);
            chart.innerHTML = '';

            if (animate) {
                area.classList.remove('animating');
                void area.offsetWidth;
                area.classList.add('animating');
            }

            dayMinutes.forEach((minutes, index) => {
                const height = (minutes / maxMinutes) * 100;
                const bar = document.createElement('div');
                bar.className = animate ? 'day-bar animating' : 'day-bar';
                if (animate) bar.style.animationDelay = `${index * 0.06}s`;
                bar.style.height = `${Math.max(height, 2)}%`;
                bar.title = `${dayLabels[index]}: ${formatHM(minutes)}`;
                chart.appendChild(bar);
            });

            updateYAxis(area, maxMinutes, animate);

            const existingDayLabels = area.querySelector('.day-labels');
            if (existingDayLabels) {
                existingDayLabels.remove();
            }

            const labels = document.createElement('div');
            labels.className = animate ? 'day-labels animating' : 'day-labels';
            dayLabels.forEach(label => {
                const lbl = document.createElement('div');
                lbl.className = 'day-label';
                lbl.textContent = label;
                labels.appendChild(lbl);
            });
            area.appendChild(labels);
        }

        function easeOutCubic(t) {
            return 1 - Math.pow(1 - t, 3);
        }

        function triggerLineChartAnimation() {
            const container = document.getElementById('lineChartContainer');
            if (container) {
                container.classList.remove('animating');
                void container.offsetWidth;
                container.classList.add('animating');
            }
        }

        function startLineChartAnimation() {
            if (lineChartAnimId) cancelAnimationFrame(lineChartAnimId);
            lineChartAnimProgress = 0;
            triggerLineChartAnimation();

            const start = performance.now();
            const duration = 900;

            function step(now) {
                const elapsed = now - start;
                lineChartAnimProgress = Math.min(1, elapsed / duration);
                lineChartAnimProgress = easeOutCubic(lineChartAnimProgress);
                renderLineChartFrame();

                if (elapsed < duration) {
                    lineChartAnimId = requestAnimationFrame(step);
                } else {
                    lineChartAnimProgress = 1;
                    renderLineChartFrame();
                }
            }

            lineChartAnimId = requestAnimationFrame(step);
        }

        function renderLineChartFrame() {
            if (!lineChartCurrentConfig) return;
            const { ctx, canvas, chartWidth, chartHeight, padding, graphWidth, graphHeight, niceMax, points, allDates } = lineChartCurrentConfig;
            const progress = lineChartAnimProgress;

            ctx.clearRect(0, 0, chartWidth, chartHeight);
            ctx.save();

            // ── 横向网格 ──
            const ySteps = 4;
            ctx.globalAlpha = progress;
            for (let i = 0; i <= ySteps; i++) {
                const y = padding.top + (graphHeight / ySteps) * i;
                ctx.beginPath();
                ctx.strokeStyle = i === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)';
                ctx.lineWidth = 1;
                ctx.moveTo(padding.left, y);
                ctx.lineTo(chartWidth - padding.right, y);
                ctx.stroke();

                const val = Math.round(niceMax * (1 - i / ySteps));
                ctx.fillStyle = 'rgba(255,255,255,0.45)';
                ctx.font = '11px -apple-system, sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(formatHM(val), padding.left - 10, y + 4);
            }
            ctx.globalAlpha = 1;

            // 进度裁剪区：从左向右展开
            ctx.beginPath();
            ctx.rect(padding.left, 0, graphWidth * progress, chartHeight);
            ctx.clip();

            // ── 竖向淡线 ──
            const vertStep = Math.max(1, Math.floor(points.length / 8));
            points.forEach((p, i) => {
                if (i % vertStep !== 0 && i !== points.length - 1) return;
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255,255,255,0.04)';
                ctx.lineWidth = 1;
                ctx.moveTo(p.x, padding.top);
                ctx.lineTo(p.x, padding.top + graphHeight);
                ctx.stroke();
            });

            // ── 面积渐变填充 ──
            const areaGrad = ctx.createLinearGradient(0, padding.top, 0, padding.top + graphHeight);
            areaGrad.addColorStop(0, 'rgba(99,179,237,0.22)');
            areaGrad.addColorStop(0.55, 'rgba(99,179,237,0.06)');
            areaGrad.addColorStop(1, 'rgba(99,179,237,0)');
            lineChartDrawCurve(points);
            ctx.lineTo(points[points.length - 1].x, padding.top + graphHeight);
            ctx.lineTo(points[0].x, padding.top + graphHeight);
            ctx.closePath();
            ctx.fillStyle = areaGrad;
            ctx.fill();

            // ── 主线 ──
            const lineGrad = ctx.createLinearGradient(padding.left, 0, chartWidth - padding.right, 0);
            lineGrad.addColorStop(0, '#63b3ed');
            lineGrad.addColorStop(0.5, '#90cdf4');
            lineGrad.addColorStop(1, '#bee3f8');
            ctx.strokeStyle = lineGrad;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            lineChartDrawCurve(points);
            ctx.stroke();

            ctx.restore();

            // ── 今日终点标记 ──
            const revealThreshold = padding.left + graphWidth * progress;
            const lastPoint = points[points.length - 1];
            if (lastPoint && lastPoint.x <= revealThreshold && lastPoint.minutes > 0) {
                const pointProgress = progress >= 1 ? 1 : Math.min(1, Math.max(0, (revealThreshold - lastPoint.x) / 8));

                ctx.beginPath();
                ctx.arc(lastPoint.x, lastPoint.y, 4 * pointProgress, 0, Math.PI * 2);
                ctx.fillStyle = '#63b3ed';
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // ── 悬浮高亮点 ──
            if (lineChartMousePos && progress >= 0.98) {
                let best = null, bestD = Infinity;
                points.forEach(p => {
                    if (p.minutes === 0) return;
                    const d = Math.hypot(p.x - lineChartMousePos.mx, p.y - lineChartMousePos.my);
                    if (d < bestD) { bestD = d; best = p; }
                });

                if (best && bestD < 28) {
                    ctx.save();
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
                    ctx.lineWidth = 1;
                    ctx.moveTo(best.x, padding.top);
                    ctx.lineTo(best.x, padding.top + graphHeight);
                    ctx.stroke();
                    ctx.restore();

                    ctx.beginPath();
                    ctx.arc(best.x, best.y, 9, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(99,179,237,0.15)';
                    ctx.fill();

                    ctx.beginPath();
                    ctx.arc(best.x, best.y, 5, 0, Math.PI * 2);
                    ctx.fillStyle = '#63b3ed';
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                }
            }

            // ── X 轴标签 ──
            const labelStep = Math.max(1, Math.floor(points.length / 8));
            ctx.globalAlpha = progress;
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '10px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            points.forEach((p, i) => {
                if (i % labelStep === 0 || i === points.length - 1) {
                    ctx.fillText(p.date, p.x, chartHeight - 12);
                }
            });
            ctx.globalAlpha = 1;
        }

        function lineChartDrawCurve(pts, tension = 0.1) {
            if (!lineChartCurrentConfig || pts.length < 2) return;
            const { ctx } = lineChartCurrentConfig;
            const factor = tension / 6;
            const splineSegments = (points) => {
                const segs = [];
                for (let i = 0; i < points.length - 1; i++) {
                    const p0 = i > 0 ? points[i - 1] : points[i];
                    const p1 = points[i];
                    const p2 = points[i + 1];
                    const p3 = i < points.length - 2 ? points[i + 2] : points[i + 1];
                    segs.push({
                        cp1x: p1.x + (p2.x - p0.x) * factor,
                        cp1y: p1.y + (p2.y - p0.y) * factor,
                        cp2x: p2.x - (p3.x - p1.x) * factor,
                        cp2y: p2.y - (p3.y - p1.y) * factor,
                        x: p2.x, y: p2.y
                    });
                }
                return segs;
            };

            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            if (pts.length === 2 || tension <= 0) {
                pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
            } else {
                const segs = splineSegments(pts);
                segs.forEach(s => ctx.bezierCurveTo(s.cp1x, s.cp1y, s.cp2x, s.cp2y, s.x, s.y));
            }
        }

        function drawLineChart(animate = false) {
            const dateMap = {};
            records.forEach(r => {
                if (!dateMap[r.date]) dateMap[r.date] = 0;
                dateMap[r.date] += Math.floor(r.duration / 60);
            });

            const sortedDates = Object.keys(dateMap).sort();
            if (sortedDates.length === 0) return;

            const firstDate = new Date(sortedDates[0].replace(/\//g, '-'));
            const lastDate = new Date();
            const allDates = [], allMinutes = [];
            const currentDate = new Date(firstDate);
            while (currentDate <= lastDate) {
                const dateStr = currentDate.toLocaleDateString('zh-CN');
                allDates.push(dateStr.split('/').slice(1).join('/'));
                allMinutes.push(dateMap[dateStr] || 0);
                currentDate.setDate(currentDate.getDate() + 1);
            }

            const container = document.getElementById('lineChartContainer');
            const containerWidth = container.offsetWidth - 36;
            const canvas = document.getElementById('lineChart');
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;

            const padding = { top: 30, right: 35, bottom: 48, left: 55 };
            const chartWidth = containerWidth;
            const chartHeight = 260;
            canvas.width = chartWidth * dpr;
            canvas.height = chartHeight * dpr;
            canvas.style.width = chartWidth + 'px';
            canvas.style.height = chartHeight + 'px';
            ctx.scale(dpr, dpr);

            const maxVal = Math.max(...allMinutes, 1);
            const niceMax = Math.ceil(maxVal / 60) * 60 || 60;
            const graphWidth = chartWidth - padding.left - padding.right;
            const graphHeight = chartHeight - padding.top - padding.bottom;
            const stepX = graphWidth / (allDates.length - 1 || 1);

            const points = [];
            allMinutes.forEach((minutes, index) => {
                points.push({
                    x: padding.left + index * stepX,
                    y: padding.top + graphHeight - (minutes / niceMax) * graphHeight,
                    date: allDates[index],
                    minutes
                });
            });

            lineChartCurrentConfig = { ctx, canvas, chartWidth, chartHeight, padding, graphWidth, graphHeight, niceMax, points, allDates };

            if (animate) {
                startLineChartAnimation();
            } else {
                if (lineChartAnimId) {
                    cancelAnimationFrame(lineChartAnimId);
                    lineChartAnimId = null;
                }
                lineChartAnimProgress = 1;
                renderLineChartFrame();
            }

            // ── Tooltip ──
            let tooltip = document.getElementById('lineChartTooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'lineChartTooltip';
                tooltip.className = 'line-chart-tooltip';
                tooltip.style.cssText = `
                    position:absolute;background:rgba(20,25,40,0.92);
                    border:1px solid rgba(99,179,237,0.45);border-radius:10px;
                    padding:8px 14px;color:#fff;font-size:12px;
                    pointer-events:none;z-index:100;display:none;
                    white-space:nowrap;backdrop-filter:blur(10px);
                    box-shadow:0 4px 20px rgba(0,0,0,0.4);
                    font-family:-apple-system,sans-serif;
                `;
                document.getElementById('lineChartWrapper').appendChild(tooltip);
            }

            canvas.onmousemove = (e) => {
                const rect = canvas.getBoundingClientRect();
                const sx = chartWidth / rect.width;
                const sy = chartHeight / rect.height;
                const mx = (e.clientX - rect.left) * sx;
                const my = (e.clientY - rect.top) * sy;
                lineChartMousePos = { mx, my };

                let best = null, bestD = Infinity;
                points.forEach(p => {
                    if (p.minutes === 0) return;
                    const d = Math.hypot(p.x - mx, p.y - my);
                    if (d < bestD) { bestD = d; best = p; }
                });

                if (best && bestD < 28) {
                    tooltip.innerHTML = `<div style="font-weight:600;margin-bottom:2px">${best.date}</div><div style="color:#90cdf4">${formatHM(best.minutes)}</div>`;

                    let tx = best.x + 16, ty = best.y - 38;
                    const tw = tooltip.offsetWidth || 100;
                    if (tx + tw > chartWidth) tx = best.x - tw - 16;
                    if (ty < 6) ty = best.y + 16;
                    tooltip.style.left = tx + 'px';
                    tooltip.style.top = ty + 'px';
                    tooltip.style.display = 'block';
                } else {
                    tooltip.style.display = 'none';
                }

                renderLineChartFrame();
            };
            canvas.onmouseleave = () => {
                lineChartMousePos = null;
                tooltip.style.display = 'none';
                renderLineChartFrame();
            };
        }

        function toggleChartMode() {
            showAllDays = !showAllDays;
            const chartsContainer = document.getElementById('chartsContainer');
            const lineChartContainer = document.getElementById('lineChartContainer');
            
            if (showAllDays) {
                chartsContainer.style.display = 'none';
                lineChartContainer.style.display = 'block';
                requestAnimationFrame(() => drawLineChart(true));
            } else {
                chartsContainer.style.display = 'flex';
                lineChartContainer.style.display = 'none';
                requestAnimationFrame(() => {
                    drawHourChart(true);
                    drawDayChart(true);
                });
            }
        }

        function closeModal(modalId) {
            const modal = document.getElementById(modalId);
            if (!modal || !modal.classList.contains('active')) return;
            const content = modal.querySelector('.modal-content');
            const finish = () => {
                modal.classList.remove('active');
                if (content) content.classList.remove('closing');
                if (!isStudying) {
                    document.getElementById('startBtn').style.display = 'block';
                    document.getElementById('recordsBtn').style.display = 'block';
                }
                // 设置面板关闭时，重置所有子面板，回到主面板
                if (modalId === 'settingsModal') {
                    const mainPanel = document.getElementById('settingsMainPanel');
                    if (mainPanel) mainPanel.style.display = 'block';
                    document.querySelectorAll('.settings-content').forEach(p => {
                        if (p.id !== 'settingsMainPanel') p.style.display = 'none';
                    });
                    // 清理壁纸面板展开状态
                    const settingsContent = modal.querySelector('.settings-modal-content');
                    if (settingsContent) settingsContent.classList.remove('wallpaper-expanded');
                }
                // 记录面板关闭时，重置更多图表状态
                if (modalId === 'recordsModal') {
                    closeMoreCharts();
                }
            };
            if (content) {
                content.classList.add('closing');
                content.addEventListener('animationend', function handler() {
                    content.removeEventListener('animationend', handler);
                    finish();
                });
            } else {
                finish();
            }
        }

        // ==================== 雨滴卡片效果（atmos-fx rain-card） ====================
        let rainCardEffects = []; // { effect, renderer, canvas, orb, animId, refractionImg }
        let rainCardPending = []; // 等待 modal 打开后创建 renderer 的条目
        let rainCardActive = false;
        let rainCardRefractionTimer = null;

        function openRainCardParams() {
            const row = document.getElementById('rainCardParamsRow');
            if (row && row.classList.contains('setting-item-disabled')) return;
            const parentPanel = document.getElementById('envFxParamsPanel');
            const paramsPanel = document.getElementById('rainCardParamsPanel');
            if (parentPanel) parentPanel.style.display = 'none';
            if (paramsPanel) paramsPanel.style.display = 'block';
        }

        function closeRainCardParams() {
            const parentPanel = document.getElementById('envFxParamsPanel');
            const paramsPanel = document.getElementById('rainCardParamsPanel');
            if (paramsPanel) paramsPanel.style.display = 'none';
            if (parentPanel) parentPanel.style.display = 'block';
        }

        function openRainFallParams() {
            const row = document.getElementById('rainFallParamsRow');
            if (row && row.classList.contains('setting-item-disabled')) return;
            const parentPanel = document.getElementById('envFxParamsPanel');
            const paramsPanel = document.getElementById('rainFallParamsPanel');
            if (parentPanel) parentPanel.style.display = 'none';
            if (paramsPanel) paramsPanel.style.display = 'block';
        }

        function closeRainFallParams() {
            const parentPanel = document.getElementById('envFxParamsPanel');
            const paramsPanel = document.getElementById('rainFallParamsPanel');
            if (paramsPanel) paramsPanel.style.display = 'none';
            if (parentPanel) parentPanel.style.display = 'block';
        }

        function openAcMistParams() {
            const row = document.getElementById('acMistParamsRow');
            if (row && row.classList.contains('setting-item-disabled')) return;
            const parentPanel = document.getElementById('envFxParamsPanel');
            const paramsPanel = document.getElementById('acMistParamsPanel');
            if (parentPanel) parentPanel.style.display = 'none';
            if (paramsPanel) paramsPanel.style.display = 'block';
        }

        function closeAcMistParams() {
            const parentPanel = document.getElementById('envFxParamsPanel');
            const paramsPanel = document.getElementById('acMistParamsPanel');
            if (paramsPanel) paramsPanel.style.display = 'none';
            if (parentPanel) parentPanel.style.display = 'block';
        }

        function openBonfireParams() {
            const row = document.getElementById('bonfireParamsRow');
            if (row && row.classList.contains('setting-item-disabled')) return;
            const parentPanel = document.getElementById('envFxParamsPanel');
            const paramsPanel = document.getElementById('bonfireParamsPanel');
            if (parentPanel) parentPanel.style.display = 'none';
            if (paramsPanel) paramsPanel.style.display = 'block';
        }

        function closeBonfireParams() {
            const parentPanel = document.getElementById('envFxParamsPanel');
            const paramsPanel = document.getElementById('bonfireParamsPanel');
            if (paramsPanel) paramsPanel.style.display = 'none';
            if (parentPanel) parentPanel.style.display = 'block';
        }

        function openFireflyParams() {
            const row = document.getElementById('fireflyParamsRow');
            if (row && row.classList.contains('setting-item-disabled')) return;
            const parentPanel = document.getElementById('envFxParamsPanel');
            const paramsPanel = document.getElementById('fireflyParamsPanel');
            if (parentPanel) parentPanel.style.display = 'none';
            if (paramsPanel) paramsPanel.style.display = 'block';
        }

        function closeFireflyParams() {
            const parentPanel = document.getElementById('envFxParamsPanel');
            const paramsPanel = document.getElementById('fireflyParamsPanel');
            if (paramsPanel) paramsPanel.style.display = 'none';
            if (parentPanel) parentPanel.style.display = 'block';
        }

        function updateFireflyParamsRow() {
            const settings = getSettings();
            const row = document.getElementById('fireflyParamsRow');
            if (row) {
                if (settings.fireflyEnabled && settings.envFxEnabled) {
                    row.classList.remove('setting-item-disabled');
                } else {
                    row.classList.add('setting-item-disabled');
                }
            }
        }

        function updateRainCardParamsRow() {
            const settings = getSettings();
            const row = document.getElementById('rainCardParamsRow');
            if (row) {
                if (settings.rainCardEnabled && settings.envFxEnabled) {
                    row.classList.remove('setting-item-disabled');
                } else {
                    row.classList.add('setting-item-disabled');
                }
            }
        }

        function updateRainFallParamsRow() {
            const settings = getSettings();
            const row = document.getElementById('rainFallParamsRow');
            if (row) {
                // 下雨效果仅在雨滴效果开启且环境特效开启时可点击
                if (settings.rainFallEnabled && settings.rainCardEnabled && settings.envFxEnabled) {
                    row.classList.remove('setting-item-disabled');
                } else {
                    row.classList.add('setting-item-disabled');
                }
            }
        }

        // 全屏下雨效果
        let rainFallCanvas = null;
        let rainFallCtx = null;
        let rainFallAnimId = null;
        const RAIN_FALL_COUNT = 200; // 雨丝数量
        let rainDrops = [];
        // 下雨方向鼠标追踪
        let rainFallCurrentAngle = 0; // 当前角度（弧度，正=向右偏）
        let rainFallTargetAngle = 0;  // 目标角度
        const RAIN_FALL_MAX_ANGLE = 30 * Math.PI / 180; // ±30°
        const RAIN_FALL_LERP = 0.04; // 追踪惯性

        function rainFallMouseMoveHandler(e) {
            // 鼠标 x 归一化到 -1~1，取反映射（鼠标右→雨往左偏），映射到 -maxAngle~+maxAngle
            rainFallTargetAngle = (1 - (e.clientX / window.innerWidth) * 2) * RAIN_FALL_MAX_ANGLE;
        }

        // ===== 飞溅粒子系统 =====
        const MAX_SPLASH_PARTICLES = 320;
        const SPLASH_PARTICLES_PER_HIT = 5;
        let SPLASH_PARTICLES_PER_HIT_CURRENT = 5;
        let splashParticles = [];
        for (let i = 0; i < MAX_SPLASH_PARTICLES; i++) {
            splashParticles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, lifetime: 0, length: 0, width: 0, alpha: 0 });
        }
        let splashCursor = 0;

        function spawnSplash(x, y, sourceVx, depth, nx, ny) {
            nx = nx || 0; ny = ny || -1;
            const count = Math.max(2, Math.round(SPLASH_PARTICLES_PER_HIT_CURRENT * depth));
            for (let index = 0; index < count; index++) {
                const p = splashParticles[splashCursor];
                const direction = index % 2 === 0 ? -1 : 1;
                const spread = (42 + Math.random() * 103) * direction * (0.55 + Math.random() * 0.45);
                // 计算法线方向的切线方向
                const tx = -ny, ty = nx;
                const normalSpeed = (65 + Math.random() * 95) * depth;
                const tangentSpeed = spread;
                p.active = true;
                p.x = x;
                p.y = y;
                p.vx = nx * normalSpeed + tx * tangentSpeed;
                p.vy = ny * normalSpeed + ty * tangentSpeed;
                p.age = 0;
                p.lifetime = 0.18 + Math.random() * 0.16;
                p.length = (2.5 + Math.random() * 2.5) * depth;
                p.width = (1 + Math.random()) * depth;
                p.alpha = (0.32 + Math.random() * 0.4) * depth;
                splashCursor = (splashCursor + 1) % MAX_SPLASH_PARTICLES;
            }
        }

        function updateAndRenderSplash(ctx, deltaSeconds, w, h) {
            ctx.strokeStyle = 'rgba(174, 194, 224, 1)';
            for (const p of splashParticles) {
                if (!p.active) continue;
                p.age += deltaSeconds;
                if (p.age >= p.lifetime) { p.active = false; continue; }
                p.vy += 520 * deltaSeconds;
                p.x += p.vx * deltaSeconds;
                p.y += p.vy * deltaSeconds;
                if (p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) { p.active = false; continue; }
                const lifeProgress = p.age / p.lifetime;
                const alpha = p.alpha * (1 - lifeProgress);
                const tailX = p.x - p.vx * 0.012;
                const tailY = p.y - p.vy * 0.012 - p.length;
                ctx.globalAlpha = alpha;
                ctx.lineWidth = p.width;
                ctx.beginPath();
                ctx.moveTo(tailX, tailY);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }



        // ===== 碰撞目标收集 =====
        let collisionTargets = [];
        let collisionElements = [];

        function collectCollisionTargets() {
            const selector = '.glass-orb, #soundBtn, #settingsBtn, .btn-start, .btn-records, .stop-btn, .break-btn, .modal-content, .break-board';
            if (collisionElements.length === 0) {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    if (!(el instanceof HTMLElement)) return;
                    const style = window.getComputedStyle(el);
                    const borderRadius = parseFloat(style.borderTopLeftRadius || style.borderRadius) || 0;
                    collisionElements.push({
                        element: el,
                        isGlassOrb: el.classList.contains('glass-orb'),
                        borderRadius: borderRadius
                    });
                });
            }
            const isSquareTheme = document.body.classList.contains('theme-square');
            collisionTargets = [];
            collisionElements.forEach(ce => {
                const el = ce.element;
                const rect = el.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return;
                // 跳过不可见的元素（visibility:hidden 或 opacity:0 或 display:none 的按钮，以及不在视口内的元素）
                const style = window.getComputedStyle(el);
                if (style.visibility === 'hidden' || parseFloat(style.opacity) <= 0 || style.display === 'none') return;
                if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) return;

                if (ce.isGlassOrb) {
                    // 获取 glass-orb 的原始尺寸（旋转前的尺寸，不含 bounding box 扩展）
                    const orbClass = Object.keys(glassOrbSpeeds).find(cls => el.classList.contains(cls));
                    const angle = (orbClass && glassOrbRotations[orbClass]) ? glassOrbRotations[orbClass] : 0;
                    const isCircular = !isSquareTheme;
                    // 使用中心点和原始尺寸（非 bounding box），避免旋转后 bbox 变大
                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2;
                    // 旋转后 getBoundingClientRect 会返回更大的包围盒，需要反算原始尺寸
                    // 对于正方形旋转 angle 度，bbox = side * (|cos(a)| + |sin(a)|)
                    const cosA = Math.abs(Math.cos(angle * Math.PI / 180));
                    const sinA = Math.abs(Math.sin(angle * Math.PI / 180));
                    const side = (cosA + sinA) > 0.01 ? rect.width / (cosA + sinA) : rect.width;

                    if (isCircular) {
                        collisionTargets.push({
                            element: el, isCircular: true,
                            cx: cx, cy: cy, radius: side / 2,
                            width: side, height: side
                        });
                    } else {
                        collisionTargets.push({
                            element: el, isCircular: false, isRotatedRect: true,
                            cx: cx, cy: cy,
                            width: side, height: side,
                            angle: angle,
                            borderRadius: 4
                        });
                    }
                } else {
                    const isCircular = ce.borderRadius >= rect.width / 2 - 1;
                    collisionTargets.push({
                        element: el,
                        x: rect.left, y: rect.top,
                        width: rect.width, height: rect.height,
                        right: rect.left + rect.width, bottom: rect.top + rect.height,
                        borderRadius: Math.min(ce.borderRadius, rect.width / 2, rect.height / 2),
                        isCircular: isCircular,
                        cx: rect.left + rect.width / 2,
                        cy: rect.top + rect.height / 2,
                        radius: rect.width / 2
                    });
                }
            });
            collisionTargets.sort((a, b) => (a.y || (a.cy - a.height/2)) - (b.y || (b.cy - b.height/2)));
        }

        function checkRainCollision(prevX, prevY, nextX, nextY) {
            if (nextY <= prevY) return null;
            let nearest = null;
            let nearestProgress = Infinity;
            for (const target of collisionTargets) {
                if (target.isCircular) {
                    // 圆形碰撞检测：检查线段与圆的交点，只接受上半部分（法线朝上）
                    const cx = target.cx, cy = target.cy, r = target.radius;
                    const dx = nextX - prevX, dy = nextY - prevY;
                    const fx = prevX - cx, fy = prevY - cy;
                    const a = dx * dx + dy * dy;
                    const b = 2 * (fx * dx + fy * dy);
                    const c = fx * fx + fy * fy - r * r;
                    let disc = b * b - 4 * a * c;
                    if (disc < 0) continue;
                    disc = Math.sqrt(disc);
                    const t1 = (-b - disc) / (2 * a);
                    const t2 = (-b + disc) / (2 * a);
                    let t = -1;
                    if (t1 >= 0 && t1 <= 1) t = t1;
                    else if (t2 >= 0 && t2 <= 1) t = t2;
                    if (t < 0 || t >= nearestProgress) continue;
                    const hitX = prevX + dx * t;
                    const hitY = prevY + dy * t;
                    // 法线：从圆心指向交点
                    const nx = (hitX - cx) / r;
                    const ny = (hitY - cy) / r;
                    // 只接受上半部分碰撞（法线朝上 ny < 0），雨从上方落下不会打到下半部分
                    if (ny > 0) continue;
                    nearestProgress = t;
                    nearest = { x: hitX, y: hitY, target: target, nx: nx, ny: ny };
                } else if (target.isRotatedRect) {
                    // 旋转矩形碰撞检测：将线段变换到矩形的局部坐标系
                    const cx = target.cx, cy = target.cy;
                    const hw = target.width / 2, hh = target.height / 2;
                    const rad = -target.angle * Math.PI / 180; // 反向旋转
                    const cosR = Math.cos(rad), sinR = Math.sin(rad);
                    // 将线段端点变换到局部坐标系（以矩形中心为原点，无旋转）
                    const lx1 = (prevX - cx) * cosR - (prevY - cy) * sinR;
                    const ly1 = (prevX - cx) * sinR + (prevY - cy) * cosR;
                    const lx2 = (nextX - cx) * cosR - (nextY - cy) * sinR;
                    const ly2 = (nextX - cx) * sinR + (nextY - cy) * cosR;
                    // 在局部坐标系中检测线段与矩形的交点
                    const localHit = lineRectIntersection(lx1, ly1, lx2, ly2, -hw, -hh, hw, hh);
                    if (!localHit || localHit.t >= nearestProgress) continue;
                    nearestProgress = localHit.t;
                    // 将交点和法线变换回全局坐标系
                    const lhx = lx1 + (lx2 - lx1) * localHit.t;
                    const lhy = ly1 + (ly2 - ly1) * localHit.t;
                    const cosP = Math.cos(target.angle * Math.PI / 180);
                    const sinP = Math.sin(target.angle * Math.PI / 180);
                    const hitX = lhx * cosP - lhy * sinP + cx;
                    const hitY = lhx * sinP + lhy * cosP + cy;
                    // 法线变换到全局坐标系
                    const nx = localHit.nx * cosP - localHit.ny * sinP;
                    const ny = localHit.nx * sinP + localHit.ny * cosP;
                    // 只接受上半部分碰撞（全局法线朝上 ny < 0），雨从上方落下不会打到朝下的面
                    if (ny > 0) continue;
                    nearest = { x: hitX, y: hitY, target: target, nx: nx, ny: ny };
                } else {
                    // 轴对齐矩形碰撞检测
                    if (target.y < prevY || target.y > nextY) continue;
                    const progress = (target.y - prevY) / (nextY - prevY);
                    if (progress < 0 || progress > 1 || progress >= nearestProgress) continue;
                    const hitX = prevX + (nextX - prevX) * progress;
                    const r = target.borderRadius || 0;
                    if (hitX >= target.x + r && hitX <= target.right - r) {
                        nearestProgress = progress;
                        nearest = { x: hitX, y: target.y, target: target, nx: 0, ny: -1 };
                    }
                }
            }
            return nearest;
        }

        // 线段与轴对齐矩形的交点检测（局部坐标系）
        function lineRectIntersection(x1, y1, x2, y2, left, top, right, bottom) {
            const dx = x2 - x1, dy = y2 - y1;

            // 检查4条边
            const edges = [
                { p: left,   axisX: true,  lo: top, hi: bottom, nx: -1, ny: 0 },  // 左边
                { p: right,  axisX: true,  lo: top, hi: bottom, nx: 1,  ny: 0 },  // 右边
                { p: top,    axisX: false, lo: left, hi: right, nx: 0,  ny: -1 }, // 上边
                { p: bottom, axisX: false, lo: left, hi: right, nx: 0,  ny: 1 },  // 下边
            ];

            let bestT = Infinity;
            let bestNx = 0, bestNy = -1;

            for (const e of edges) {
                const d = e.axisX ? dx : dy;
                if (Math.abs(d) < 0.0001) continue;
                const origin = e.axisX ? x1 : y1;
                const t = (e.p - origin) / d;
                if (t < 0 || t > 1) continue;
                const hitO = e.axisX ? (y1 + dy * t) : (x1 + dx * t);
                if (hitO < e.lo || hitO > e.hi) continue;
                if (t < bestT) { bestT = t; bestNx = e.nx; bestNy = e.ny; }
            }

            if (bestT >= Infinity) return null;
            return { t: bestT, nx: bestNx, ny: bestNy };
        }

        function createRainFall() {
            if (rainFallCanvas) return;
            rainFallCanvas = document.createElement('canvas');
            rainFallCanvas.id = 'rainFallCanvas';
            rainFallCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0.6;';
            document.body.appendChild(rainFallCanvas);
            rainFallCtx = rainFallCanvas.getContext('2d');

            // 绑定鼠标追踪
            document.addEventListener('mousemove', rainFallMouseMoveHandler);

            function resizeRainFall() {
                if (!rainFallCanvas) return;
                rainFallCanvas.width = window.innerWidth;
                rainFallCanvas.height = window.innerHeight;
            }
            resizeRainFall();
            window.addEventListener('resize', resizeRainFall);

            // 初始化雨丝
            rainDrops = [];
            for (let i = 0; i < RAIN_FALL_COUNT; i++) {
                rainDrops.push({
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight,
                    length: 10 + Math.random() * 20,
                    speed: 4 + Math.random() * 8,
                    opacity: 0.1 + Math.random() * 0.3,
                    width: 0.5 + Math.random() * 1
                });
            }
            // 应用用户设置的雨丝参数
            updateRainFallSettings();

            // 初始收集碰撞目标（后续每帧实时更新位置）
            collectCollisionTargets();

            function animateRainFall() {
                if (!rainFallCanvas || !rainFallCtx) return;
                rainFallCtx.clearRect(0, 0, rainFallCanvas.width, rainFallCanvas.height);

                // 每帧更新碰撞目标位置（跟随视差移动）
                collectCollisionTargets();

                // 平滑追踪鼠标方向
                rainFallCurrentAngle += (rainFallTargetAngle - rainFallCurrentAngle) * RAIN_FALL_LERP;
                const dx = Math.sin(rainFallCurrentAngle); // 水平分量
                const dy = Math.cos(rainFallCurrentAngle); // 垂直分量

                for (const drop of rainDrops) {
                    rainFallCtx.beginPath();
                    rainFallCtx.moveTo(drop.x, drop.y);
                    rainFallCtx.lineTo(drop.x - dx * drop.length, drop.y + dy * drop.length);
                    rainFallCtx.strokeStyle = `rgba(174, 194, 224, ${drop.opacity})`;
                    rainFallCtx.lineWidth = drop.width;
                    rainFallCtx.stroke();

                    drop.y += drop.speed * dy;
                    drop.x -= drop.speed * dx;

                    // 检测雨丝与 UI 元素碰撞
                    const prevY = drop.y - drop.speed * dy;
                    const prevX = drop.x + drop.speed * dx;
                    const collision = checkRainCollision(prevX, prevY, drop.x, drop.y);
                    if (collision) {
                        const nx = collision.nx || 0;
                        const ny = collision.ny || -1;
                        spawnSplash(collision.x, collision.y, -0.5, 0.7 + Math.random() * 0.3, nx, ny);
                    }

                    if (drop.y > rainFallCanvas.height) {
                        if (Math.random() < 0.15) {
                            spawnSplash(drop.x, rainFallCanvas.height, -0.5, 0.5, 0, -1);
                        }
                        drop.y = -drop.length;
                        drop.x = Math.random() * rainFallCanvas.width;
                    }
                }

                // 渲染飞溅粒子和堆积水滴
                const now = performance.now();
                const deltaSec = Math.min(0.05, (now - (animateRainFall._lastTime || now)) / 1000);
                animateRainFall._lastTime = now;
                updateAndRenderSplash(rainFallCtx, deltaSec, rainFallCanvas.width, rainFallCanvas.height);

                rainFallAnimId = requestAnimationFrame(animateRainFall);
            }
            rainFallAnimId = requestAnimationFrame(animateRainFall);
        }

        function destroyRainFall() {
            if (rainFallAnimId) {
                cancelAnimationFrame(rainFallAnimId);
                rainFallAnimId = null;
            }
            document.removeEventListener('mousemove', rainFallMouseMoveHandler);
            if (rainFallCanvas && rainFallCanvas.parentNode) {
                rainFallCanvas.parentNode.removeChild(rainFallCanvas);
            }
            rainFallCanvas = null;
            rainFallCtx = null;
            rainDrops = [];
            rainFallCurrentAngle = 0;
            rainFallTargetAngle = 0;
            splashParticles.forEach(p => p.active = false);
            collisionTargets = [];
            collisionElements = [];
        }

        // 捕获元素后面背景的截图作为折射纹理
        function captureRefractionForOrb(target) {
            const rect = target.getBoundingClientRect();
            const scale = 0.5; // 降采样以提升性能
            const w = Math.max(1, Math.round(rect.width * scale));
            const h = Math.max(1, Math.round(rect.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            // 绘制清澈的浅色背景模拟玻璃折射
            const gradient = ctx.createRadialGradient(w * 0.35, h * 0.35, 0, w * 0.5, h * 0.5, w * 0.7);
            gradient.addColorStop(0, 'rgba(230, 240, 250, 0.2)');
            gradient.addColorStop(0.5, 'rgba(210, 225, 240, 0.1)');
            gradient.addColorStop(1, 'rgba(190, 205, 220, 0.05)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);
            // 应用模糊效果模拟 backdrop-filter
            ctx.filter = 'blur(8px)';
            ctx.drawImage(canvas, 0, 0);
            ctx.filter = 'none';
            return canvas;
        }

        // 动态更新折射纹理
        function updateRefractionTextures() {
            const RCFX = window.RainCardFX;
            if (!RCFX || !rainCardActive) return;
            for (const entry of rainCardEffects) {
                if (!entry.renderer) continue;
                try {
                    const refractionCanvas = captureRefractionForOrb(entry.target);
                    const glContext = entry.renderer.gl; // GlContext 实例
                    if (glContext && glContext.gl) {
                        const gl = glContext.gl; // WebGLRenderingContext
                        // 折射纹理是第3个纹理（unit 2）
                        gl.activeTexture(gl.TEXTURE2);
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, refractionCanvas);
                    }
                } catch(e) {
                    // 忽略纹理更新错误
                }
            }
        }

        function addRainCardEffects() {
            if (rainCardActive) return;
            const RCFX = window.RainCardFX;
            if (!RCFX) {
                console.warn('RainCardFX not loaded');
                return;
            }
            rainCardActive = true;
            const targets = document.querySelectorAll('.glass-orb, #soundBtn, #settingsBtn, .btn-start, .btn-records, .stop-btn, .break-btn, .modal-content, .break-board');
            const settings = getSettings();

            // 先预加载共享资源，再初始化所有效果
            RCFX.loadSharedRainAssets().then((sharedAssets) => {
                if (!rainCardActive) return;

                targets.forEach(target => {
                    // 跳过已有雨滴效果的子元素（避免与父元素重复渲染）
                    if (target.closest('.modal-content') && !target.classList.contains('modal-content')) {
                        return;
                    }
                    // 检查元素是否可见
                    const targetStyle = window.getComputedStyle(target);
                    const isTargetHidden = targetStyle.visibility === 'hidden' || parseFloat(targetStyle.opacity) <= 0 || targetStyle.display === 'none';

                    const canvas = document.createElement('canvas');
                    canvas.className = 'rain-card-canvas';
                    canvas.setAttribute('aria-hidden', 'true');
                    // 确保元素有 position: relative
                    const currentPos = window.getComputedStyle(target).position;
                    if (currentPos === 'static') {
                        target.style.position = 'relative';
                    }
                    // modal-content 不设 overflow: hidden，避免影响滚动；其他元素设 overflow: hidden 裁剪雨滴
                    const isModalContent = target.classList.contains('modal-content');
                    if (!isModalContent) {
                        target.style.overflow = 'hidden';
                    }
                    // 根据元素类型设置不同的 canvas z-index
                    const isGlassOrb = target.classList.contains('glass-orb');
                    canvas.style.zIndex = isGlassOrb ? '1' : '0';
                    // border-radius 由 CSS 的 border-radius: inherit 自动跟随父元素，不设内联值
                    target.insertBefore(canvas, target.firstChild);

                    // 检查元素是否可见（不在隐藏的 modal 中，或 visibility:hidden/opacity:0，或不在视口内）
                    const isHidden = targetRect => targetRect.width < 10 || targetRect.height < 10 || isTargetHidden
                        || targetRect.bottom < 0 || targetRect.top > window.innerHeight || targetRect.right < 0 || targetRect.left > window.innerWidth;

                    // 延迟，确保 canvas 有了正确的 CSS 尺寸后再初始化
                    setTimeout(() => {
                            if (!rainCardActive) return;
                            // 获取目标元素实际尺寸
                            const targetRect = target.getBoundingClientRect();

                            // 按组件面积比例缩放密度，但大小保持统一
                            const area = targetRect.width * targetRect.height;
                            const refArea = 300 * 200; // 参考面积：300x200
                            const areaRatio = Math.sqrt(area / refArea); // 用面积的平方根，视觉上更均匀
                            const dropSizeScale = settings.rainCardDropSize / 100;
                            const densityScale = settings.rainCardDensity / 100;

                            const baseMinRadius = 5 * dropSizeScale;
                            const baseMaxRadius = 10 * dropSizeScale;
                            // 确保小组件也有足够的雨滴数量
                            const baseMaxDrops = Math.max(80, Math.round(400 * areaRatio * densityScale));
                            // 确保小组件的雨滴生成概率不会太低
                            const adjustedRainChance = Math.max(0.1, 0.3 * areaRatio * densityScale);

                            const effect = new RCFX.RainEffect(canvas, {
                                maxPixelRatio: 1,
                                simulation: {
                                    collisionScale: 1.5,
                                    collisionRadiusIncrease: 0.001,
                                    collisionBoostMultiplier: 0.15,
                                    collisionBoost: 2,
                                    fallSpeed: 0.06,
                                    maxDrops: Math.max(50, Math.min(1200, baseMaxDrops)),
                                    rainChance: adjustedRainChance,
                                    rainLimit: Math.max(2, Math.round(5 * densityScale)),
                                    mergeDuration: 120,
                                    minRadius: Math.max(3, baseMinRadius),
                                    maxRadius: Math.max(5, baseMaxRadius),
                                }
                            });
                            effect.setDensity(densityScale);

                            // 只有可见元素才立即启动，隐藏元素等打开时再启动
                            if (!isHidden(targetRect)) {
                                effect.start();
                            }

                            // 创建 WebGL 渲染器
                            const rendererCanvas = document.createElement('canvas');
                            const dpr = Math.min(window.devicePixelRatio || 1, 1);
                            const initW = Math.max(1, Math.round(targetRect.width * dpr)) || 300;
                            const initH = Math.max(1, Math.round(targetRect.height * dpr)) || 150;
                            rendererCanvas.width = initW;
                            rendererCanvas.height = initH;
                            const refractionCanvas = captureRefractionForOrb(target);

                            // 等待 RainEffect 初始化完成后再创建 renderer
                            effect.ready.then(() => {
                                if (!rainCardActive) return;
                                // 先 resize 确保 canvas 尺寸正确
                                effect.resize();

                                const currentRect = target.getBoundingClientRect();
                                if (currentRect.width > 10 && currentRect.height > 10) {
                                    // target 可见，直接创建 renderer
                                    const effectSize = effect.getSize();
                                    rendererCanvas.width = effectSize.width;
                                    rendererCanvas.height = effectSize.height;

                                    const renderer = new RCFX.RainRenderer(
                                        rendererCanvas,
                                        null,
                                        refractionCanvas,
                                        {
                                            brightness: settings.rainCardBrightness / 100,
                                            minRefraction: 84 * (settings.rainCardRefraction / 100),
                                            maxRefraction: 336 * (settings.rainCardRefraction / 100),
                                            bodyOpacity: 0.3,
                                            highlightOpacity: 0.45,
                                            alphaMultiply: 14,
                                            alphaSubtract: 5.5,
                                            renderShadow: true,
                                            shadowOpacity: 0.3,
                                            shadowOffset: 6,
                                            bodyColor: [0.45, 0.55, 0.65],
                                            highlightColor: [0.92, 0.94, 1.0],
                                        }
                                    );
                                    const entry = { effect, renderer, canvas, target, rendererCanvas };
                                    rainCardEffects.push(entry);
                                    startRainCardAnimation();
                                    effect.start();
                                } else {
                                    // target 隐藏（如 modal），延迟创建 renderer
                                    // 当 modal 打开时由 MutationObserver 触发
                                    rainCardPending.push({ effect, canvas, target, rendererCanvas, refractionCanvas, settings });
                                }
                            }).catch(err => {
                                console.error('RainEffect init failed:', err);
                            });
                    });
                });
            }).catch(err => {
                console.error('Failed to load shared rain assets:', err);
            });

            // 定期更新折射纹理（每2秒）
            rainCardRefractionTimer = setInterval(updateRefractionTextures, 2000);

            // 启动滴水效果
            addLiquidDripEffects();

            // 监听 modal 显示/隐藏 和按钮可见性变化，控制雨滴效果的启停
            if (!window._rainCardModalObserver) {
                // 使用 MutationObserver 监听 class 变化
                window._rainCardModalObserver = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') continue;
                        const el = mutation.target;
                        
                        // 处理 modal 的 active 状态变化
                        if (el.classList.contains('modal')) {
                            const modalContent = el.querySelector('.modal-content');
                            if (!modalContent) continue;
                            const isVisible = el.classList.contains('active');
                            if (isVisible) {
                                // 为 modal-content 增量添加滴水效果
                                addLiquidDripForElements([modalContent]);
                                setTimeout(() => {
                                    // 先检查 pending 列表
                                    const pendingIdx = rainCardPending.findIndex(p => p.target === modalContent);
                                    if (pendingIdx >= 0) {
                                        const p = rainCardPending.splice(pendingIdx, 1)[0];
                                        p.effect.resize();
                                        const effectSize = p.effect.getSize();
                                        p.rendererCanvas.width = effectSize.width;
                                        p.rendererCanvas.height = effectSize.height;

                                        const curSettings = p.settings || getSettings();
                                        const renderer = new RCFX.RainRenderer(
                                            p.rendererCanvas,
                                            null,
                                            p.refractionCanvas,
                                            {
                                                brightness: curSettings.rainCardBrightness / 100,
                                                minRefraction: 84 * (curSettings.rainCardRefraction / 100),
                                                maxRefraction: 336 * (curSettings.rainCardRefraction / 100),
                                                bodyOpacity: 0.3,
                                                highlightOpacity: 0.45,
                                                alphaMultiply: 14,
                                                alphaSubtract: 5.5,
                                                renderShadow: true,
                                                shadowOpacity: 0.3,
                                                shadowOffset: 6,
                                                bodyColor: [0.45, 0.55, 0.65],
                                                highlightColor: [0.92, 0.94, 1.0],
                                            }
                                        );
                                        const entry = { effect: p.effect, renderer, canvas: p.canvas, target: p.target, rendererCanvas: p.rendererCanvas };
                                        rainCardEffects.push(entry);
                                        startRainCardAnimation();
                                        p.effect.start();
                                        p.effect.clear();
                                        return;
                                    }

                                    // 检查已有条目
                                    const rainEntry = rainCardEffects.find(e => e.target === modalContent);
                                    if (!rainEntry) return;
                                    rainEntry.effect.resize();
                                    const effectSize = rainEntry.effect.getSize();
                                    if (effectSize.width !== rainEntry.rendererCanvas.width || effectSize.height !== rainEntry.rendererCanvas.height) {
                                        rainEntry.rendererCanvas.width = effectSize.width;
                                        rainEntry.rendererCanvas.height = effectSize.height;
                                        if (rainEntry.renderer) {
                                            rainEntry.renderer.resize(effectSize.width, effectSize.height);
                                        }
                                    }
                                    rainEntry.effect.start();
                                    rainEntry.effect.clear();
                                }, 150);
                            } else {
                                // modal 变为不可见 → 停止效果
                                const rainEntry = rainCardEffects.find(e => e.target === modalContent);
                                if (rainEntry) {
                                    rainEntry.effect.stop();
                                    rainEntry.effect.clear();
                                }
                                // 移除该 modal-content 的滴水效果
                                removeLiquidDripForElement(modalContent);
                            }
                        }
                        
                        // 处理按钮（stop-btn, break-btn）的 visible 状态变化
                        if (el.classList.contains('stop-btn') || el.classList.contains('break-btn')) {
                            const isVisible = el.classList.contains('visible');
                            if (isVisible) {
                                // 为按钮增量添加滴水效果
                                addLiquidDripForElements([el]);
                                setTimeout(() => {
                                    // 检查 pending 列表
                                    const pendingIdx = rainCardPending.findIndex(p => p.target === el);
                                    if (pendingIdx >= 0) {
                                        const p = rainCardPending.splice(pendingIdx, 1)[0];
                                        p.effect.resize();
                                        const effectSize = p.effect.getSize();
                                        p.rendererCanvas.width = effectSize.width;
                                        p.rendererCanvas.height = effectSize.height;

                                        const curSettings = p.settings || getSettings();
                                        const renderer = new RCFX.RainRenderer(
                                            p.rendererCanvas,
                                            null,
                                            p.refractionCanvas,
                                            {
                                                brightness: curSettings.rainCardBrightness / 100,
                                                minRefraction: 84 * (curSettings.rainCardRefraction / 100),
                                                maxRefraction: 336 * (curSettings.rainCardRefraction / 100),
                                                bodyOpacity: 0.3,
                                                highlightOpacity: 0.45,
                                                alphaMultiply: 14,
                                                alphaSubtract: 5.5,
                                                renderShadow: true,
                                                shadowOpacity: 0.3,
                                                shadowOffset: 6,
                                                bodyColor: [0.45, 0.55, 0.65],
                                                highlightColor: [0.92, 0.94, 1.0],
                                            }
                                        );
                                        const entry = { effect: p.effect, renderer, canvas: p.canvas, target: p.target, rendererCanvas: p.rendererCanvas };
                                        rainCardEffects.push(entry);
                                        startRainCardAnimation();
                                        p.effect.start();
                                        p.effect.clear();
                                    }
                                    
                                    // 也检查已有条目（可能之前被 stop 了）
                                    const rainEntry = rainCardEffects.find(e => e.target === el);
                                    if (rainEntry) {
                                        rainEntry.effect.resize();
                                        rainEntry.effect.start();
                                        rainEntry.effect.clear();
                                    }
                                }, 150);
                            } else {
                                // 按钮变为不可见 → 停止效果
                                const rainEntry = rainCardEffects.find(e => e.target === el);
                                if (rainEntry) {
                                    rainEntry.effect.stop();
                                    rainEntry.effect.clear();
                                }
                                // 移除滴水效果
                                removeLiquidDripForElement(el);
                            }
                        }

                        // 处理 break-board 的 show 状态变化
                        if (el.classList.contains('break-board')) {
                            const isVisible = el.classList.contains('show');
                            if (isVisible) {
                                addLiquidDripForElements([el]);
                            } else {
                                removeLiquidDripForElement(el);
                            }
                        }
                    }
                });

                // 观察所有 modal、按钮和 break-board 的 class 变化
                document.querySelectorAll('.modal, .stop-btn, .break-btn, .break-board').forEach(el => {
                    window._rainCardModalObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
                });
            }
        }

        function removeRainCardEffects() {
            rainCardActive = false;
            destroyRainFall();
            removeLiquidDripEffects();
            if (rainCardRefractionTimer) {
                clearInterval(rainCardRefractionTimer);
                rainCardRefractionTimer = null;
            }
            if (window._rainCardModalObserver) {
                window._rainCardModalObserver.disconnect();
                window._rainCardModalObserver = null;
            }
            // 清理 pending 中的效果
            for (const p of rainCardPending) {
                p.effect.destroy();
                p.canvas.parentNode?.removeChild(p.canvas);
                if (p.target) p.target.style.overflow = '';
            }
            rainCardPending = [];
            for (const entry of rainCardEffects) {
                entry.effect.destroy();
                entry.renderer?.destroy();
                entry.canvas.parentNode?.removeChild(entry.canvas);
                if (entry.target) entry.target.style.overflow = '';
            }
            rainCardEffects = [];
        }

        let rainCardAnimId = null;
        function startRainCardAnimation() {
            if (rainCardAnimId) return;
            function loop(time) {
                if (!rainCardActive || rainCardEffects.length === 0) {
                    rainCardAnimId = null;
                    return;
                }
                for (const entry of rainCardEffects) {
                    if (entry.effect.isReady() && entry.renderer) {
                        // 同步 renderer canvas 尺寸
                        const effectSize = entry.effect.getSize();
                        if (effectSize.width !== entry.rendererCanvas.width || effectSize.height !== entry.rendererCanvas.height) {
                            entry.renderer.resize(effectSize.width, effectSize.height);
                        }
                        // 方正主题旋转补偿：保持雨滴沿重力方向下落
                        if (entry.target.classList.contains('glass-orb')) {
                            const isSquareTheme = document.body.classList.contains('theme-square');
                            if (isSquareTheme) {
                                const orbClass = Object.keys(glassOrbSpeeds).find(cls => entry.target.classList.contains(cls));
                                if (orbClass && glassOrbRotations[orbClass] !== undefined) {
                                    entry.canvas.style.transform = `rotate(${-glassOrbRotations[orbClass]}deg)`;
                                }
                            } else {
                                // 圆润主题：玻璃板不旋转，水滴方向重置为竖直
                                entry.canvas.style.transform = '';
                            }
                        }
                        entry.effect.render(time, entry.renderer);
                    }
                }
                rainCardAnimId = requestAnimationFrame(loop);
            }
            rainCardAnimId = requestAnimationFrame(loop);
        }

        function updateRainCardSettings() {
            const settings = getSettings();
            const densityScale = settings.rainCardDensity / 100;
            const dropSizeScale = settings.rainCardDropSize / 100;
            for (const entry of rainCardEffects) {
                entry.effect.setDensity(densityScale);
                // 更新模拟参数（大小统一不受组件面积影响）
                const sim = entry.effect['sim'];
                if (sim && sim.opts) {
                    sim.opts.minRadius = Math.max(3, 5 * dropSizeScale);
                    sim.opts.maxRadius = Math.max(5, 10 * dropSizeScale);
                    sim.opts.fallSpeed = 0.06;
                    // 同步 baseOpts 以确保 setDensity 计算正确
                    sim.baseOpts.minRadius = sim.opts.minRadius;
                    sim.baseOpts.maxRadius = sim.opts.maxRadius;
                    sim.baseOpts.fallSpeed = sim.opts.fallSpeed;
                }
                // 更新渲染器参数（opts 是 readonly 属性）
                if (entry.renderer && entry.renderer.opts) {
                    entry.renderer.opts.brightness = settings.rainCardBrightness / 100;
                    entry.renderer.opts.minRefraction = 84 * (settings.rainCardRefraction / 100);
                    entry.renderer.opts.maxRefraction = 336 * (settings.rainCardRefraction / 100);
                    entry.renderer.opts.bodyColor = [0.45, 0.55, 0.65];
                    entry.renderer.opts.highlightColor = [0.92, 0.94, 1.0];
                }
            }
        }

        // ========== 组件滴水效果（基于 atmos-fx liquid.ts 移植） ==========
        let liquidDripSvg = null;
        let liquidDrips = [];
        let liquidDripAnimId = null;
        let liquidDripActive = false;

        // 滴水动画阶段常量（毫秒）
        const LD_GATHERING_BASE_MS = 1250;
        const LD_GATHERING_MS_PER_PX = 2.8;
        const LD_MAX_GATHERING_MS = 5500;
        const LD_BULGING_MS = 900;
        const LD_STRETCHING_MS = 650;
        const LD_PINCH_MS = 270;
        const LD_FALLING_MS = 1080;
        const LD_SPLASH_MS = 280;
        const LD_COOLDOWN_MS = 320;
        const LD_POST_GATHERING_MS = LD_BULGING_MS + LD_STRETCHING_MS + LD_PINCH_MS + LD_FALLING_MS + LD_SPLASH_MS + LD_COOLDOWN_MS;

        // 水滴运动常量
        const LD_GLOBAL_SCALE = 0.8;
        const LD_ATTACHED_DROP_DIST = 63;
        const LD_FALLING_DROP_DIST = 295.8 + 109.2;
        const LD_DROPLET_START_RX = 8;
        const LD_DROPLET_END_RX = 4.5;
        const LD_DROPLET_START_RY = 8;
        const LD_DROPLET_END_RY = 18;
        const LD_DROPLET_LENGTH_SCALE = 1.3;
        const LD_DETACHED_WIDTH_SCALE = 0.7;
        const LD_DETACHED_START_LENGTH = 0.7;
        const LD_DETACHED_END_LENGTH = 0.5;
        const LD_BASE_MOTION_POWER = 3;
        const LD_MOTION_SCALE_ADJ = 1.25;
        const LD_TERMINAL_VEL_START = 0.75;
        const LD_MOTION_DURATION_S = (LD_STRETCHING_MS + LD_PINCH_MS + LD_FALLING_MS) / 1000;
        const LD_ACCEL_DURATION_S = LD_MOTION_DURATION_S * LD_TERMINAL_VEL_START;
        const LD_CONST_SPEED_S = LD_MOTION_DURATION_S - LD_ACCEL_DURATION_S;
        const LD_WAVE_FORM_MS = 800;
        const LD_RECOIL_MS = LD_FALLING_MS + LD_SPLASH_MS + LD_COOLDOWN_MS;
        const LD_RECOIL_ROTATION = Math.PI * 2;
        const LD_MIN_GATHER_PT = 0.33;
        const LD_MAX_GATHER_PT = 0.66;

        function ldEaseOutQuad(x) { return 1 - (1 - x) * (1 - x); }
        function ldEaseInQuad(x) { return x * x; }
        function ldEaseInOutQuad(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

        function ldGatheringDuration(width) {
            return Math.min(LD_MAX_GATHERING_MS, LD_GATHERING_BASE_MS + Math.max(0, width) * LD_GATHERING_MS_PER_PX);
        }

        function ldWaveCenter(startX, gatheringX, progress) {
            return startX + (gatheringX - startX) * progress;
        }

        function ldWaveY(x, dripX, leftCenter, rightCenter, pulseWidth, baseAmp, formation, releaseFade) {
            if (baseAmp === 0) return 0;
            const leftDist = Math.abs(x - leftCenter);
            const leftHeight = leftDist >= pulseWidth ? 0 : (Math.cos(Math.PI * leftDist / pulseWidth) + 1) / 2;
            const rightDist = Math.abs(x - rightCenter);
            const rightHeight = rightDist >= pulseWidth ? 0 : (Math.cos(Math.PI * rightDist / pulseWidth) + 1) / 2;
            const combined = x < dripX ? leftHeight : x > dripX ? rightHeight : Math.max(leftHeight, rightHeight);
            return (baseAmp + 2.0) * formation * releaseFade * combined;
        }

        function addLiquidDripEffects() {
            if (liquidDripActive) return;
            liquidDripActive = true;

            // 使用与雨滴划过效果相同的目标选择器（不含 modal-content 和 break-board，它们由 MutationObserver 动态管理）
            const targets = document.querySelectorAll('.glass-orb, #soundBtn, #settingsBtn, .btn-start, .btn-records, .stop-btn, .break-btn');
            // 过滤掉无效目标和子元素
            // 同时跳过 visibility:hidden 或 opacity:0 的元素（如未开始自习时的结束/暂停按钮）
            // 这些按钮变为可见时会在 startStudy 中触发重建滴水效果
            const validTargets = [];
            targets.forEach(target => {
                const style = window.getComputedStyle(target);
                if (style.visibility === 'hidden' || parseFloat(style.opacity) <= 0) return;
                if (style.display === 'none') return;
                const rect = target.getBoundingClientRect();
                if (rect.width < 10 || rect.height < 10) return;
                // 过滤掉通过 transform 移出视口的元素
                if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) return;
                validTargets.push(target);
            });
            if (validTargets.length === 0) { liquidDripActive = false; return; }

            // 创建 SVG 容器
            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.id = 'liquid-drip-svg';
            svg.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:4;opacity:0.2;';
            document.body.appendChild(svg);

            const defs = document.createElementNS(svgNS, 'defs');
            svg.appendChild(defs);

            const mainGroup = document.createElementNS(svgNS, 'g');
            svg.appendChild(mainGroup);

            liquidDripSvg = svg;
            liquidDrips = [];

            const rootRect = document.body.getBoundingClientRect();

            validTargets.forEach((target, index) => {
                const rect = target.getBoundingClientRect();
                // 对隐藏的 modal 使用估算尺寸初始化参数（打开后会实时更新位置）
                const isModalHidden = rect.width < 10 || rect.height < 10;
                const initWidth = isModalHidden ? 500 : rect.width;
                const initHeight = isModalHidden ? 400 : rect.height;

                // 创建每个组件的 gooey 滤镜
                const filterId = `ld-goo-${index}`;
                const filter = document.createElementNS(svgNS, 'filter');
                filter.setAttribute('id', filterId);
                const scale = Math.min(1.0, Math.max(0.6, initWidth / 300)) * LD_GLOBAL_SCALE;

                const blur = document.createElementNS(svgNS, 'feGaussianBlur');
                blur.setAttribute('in', 'SourceGraphic');
                blur.setAttribute('stdDeviation', (6 * scale).toFixed(2));
                blur.setAttribute('result', 'blur');

                const matrix = document.createElementNS(svgNS, 'feColorMatrix');
                matrix.setAttribute('in', 'blur');
                matrix.setAttribute('mode', 'matrix');
                matrix.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9');
                matrix.setAttribute('result', 'gooey');

                filter.appendChild(blur);
                filter.appendChild(matrix);
                defs.appendChild(filter);

                // 裁剪区域：只显示组件底部以下的内容
                const clipId = `ld-clip-${index}`;
                const clipPathEl = document.createElementNS(svgNS, 'clipPath');
                clipPathEl.setAttribute('id', clipId);
                const clipRect = document.createElementNS(svgNS, 'rect');
                const clipBottomY = isModalHidden ? 0 : (rect.top - rootRect.top + rect.height);
                clipRect.setAttribute('x', '-10000');
                clipRect.setAttribute('y', clipBottomY.toFixed(1));
                clipRect.setAttribute('width', '20000');
                clipRect.setAttribute('height', '20000');
                clipPathEl.appendChild(clipRect);
                defs.appendChild(clipPathEl);

                // 卡片组
                const cardGroup = document.createElementNS(svgNS, 'g');
                cardGroup.setAttribute('filter', `url(#${filterId})`);
                cardGroup.setAttribute('clip-path', `url(#${clipId})`);

                // 波形路径
                const path = document.createElementNS(svgNS, 'path');
                path.setAttribute('fill', 'rgb(200, 215, 230)');
                cardGroup.appendChild(path);

                // 膨胀圆
                const bulge = document.createElementNS(svgNS, 'circle');
                bulge.setAttribute('fill', 'rgb(200, 215, 230)');
                bulge.setAttribute('r', '0');
                cardGroup.appendChild(bulge);

                mainGroup.appendChild(cardGroup);

                // 水滴（独立组，不受 gooey 滤镜影响后切换父节点）
                const droplet = document.createElementNS(svgNS, 'path');
                droplet.setAttribute('fill', 'rgb(200, 215, 230)');
                cardGroup.appendChild(droplet);

                // 计算滴水位置和碰撞目标
                const isCircle = target.classList.contains('glass-orb');
                const centerX = isModalHidden ? 0 : (rect.left - rootRect.left + rect.width / 2);
                const bottomY = clipBottomY;
                let waveLeft, waveRight, dripX, clipShape;

                if (isCircle && !isModalHidden) {
                    // 圆形玻璃：滴水在圆心正下方，波形区域窄
                    const radius = rect.width / 2;
                    const narrowSpan = radius * 0.4; // 波形区域仅为圆心左右40%半径
                    waveLeft = centerX - narrowSpan;
                    waveRight = centerX + narrowSpan;
                    dripX = centerX; // 圆心正下方
                    // 裁剪区域改为圆形轮廓：只显示圆弧底部以下
                    clipShape = 'circle';
                } else if (!isModalHidden) {
                    // 矩形组件：滴水在底边中部随机位置
                    const indent = Math.min(20, rect.width * 0.15);
                    waveLeft = rect.left - rootRect.left + indent;
                    waveRight = rect.right - rootRect.left - indent;
                    const gatheringPoint = LD_MIN_GATHER_PT + Math.random() * (LD_MAX_GATHER_PT - LD_MIN_GATHER_PT);
                    dripX = waveLeft + (waveRight - waveLeft) * gatheringPoint;
                    clipShape = 'rect';
                } else {
                    // 隐藏的 modal：使用占位值，打开时会在 updateLiquidDrips 中更新
                    waveLeft = 0;
                    waveRight = 0;
                    dripX = 0;
                    clipShape = 'rect';
                }
                const gatheringMs = ldGatheringDuration(initWidth);
                const cycleMs = gatheringMs + LD_POST_GATHERING_MS;

                // 运动参数
                const motionPower = LD_BASE_MOTION_POWER + (1 - scale) * LD_MOTION_SCALE_ADJ;
                const maxDropDist = LD_ATTACHED_DROP_DIST * scale + LD_FALLING_DROP_DIST;
                const motionFactor = maxDropDist / (
                    Math.pow(LD_ACCEL_DURATION_S, motionPower) +
                    motionPower * Math.pow(LD_ACCEL_DURATION_S, motionPower - 1) * LD_CONST_SPEED_S
                );
                const terminalVel = motionPower * motionFactor * Math.pow(LD_ACCEL_DURATION_S, motionPower - 1);
                const accelDist = motionFactor * Math.pow(LD_ACCEL_DURATION_S, motionPower);

                // 找下方最近的碰撞目标
                let collisionY = 10000;
                if (!isModalHidden) {
                    validTargets.forEach(otherTarget => {
                        if (otherTarget === target) return;
                        const otherRect = otherTarget.getBoundingClientRect();
                        if (otherRect.width < 10 || otherRect.height < 10) return;
                        if (otherRect.top >= clipBottomY - 2 && dripX >= otherRect.left - rootRect.left && dripX <= otherRect.right - rootRect.left) {
                            if (otherRect.top - rootRect.top < collisionY) {
                                collisionY = otherRect.top - rootRect.top;
                            }
                        }
                    });
                }

                liquidDrips.push({
                    target,
                    index,
                    elapsed: 0,
                    phaseOffset: index * 1200,
                    waveLeft,
                    waveRight,
                    dripX,
                    gatheringMs,
                    cycleMs,
                    targetBottom: clipBottomY,
                    isCircle,
                    scale,
                    motionPower,
                    motionFactor,
                    terminalVel,
                    accelDist,
                    maxDropDist,
                    collisionY,
                    hasSplashed: false,
                    cardGroup,
                    path,
                    bulge,
                    droplet,
                    clipRect,
                    blur,
                    lastPathD: null,
                    flatPathD: null,
                });
            });

            if (liquidDrips.length > 0) {
                startLiquidDripAnimation();
                window.addEventListener('resize', updateLiquidDripPositions);
            }
        }

        // 增量为指定元素添加滴水效果（用于按钮变为可见时）
        function addLiquidDripForElements(elements) {
            if (!liquidDripActive || !liquidDripSvg) return;
            const svgGroup = liquidDripSvg.querySelector('g');
            const defs = liquidDripSvg.querySelector('defs');
            if (!svgGroup || !defs) return;
            const svgNS = 'http://www.w3.org/2000/svg';
            const rootRect = document.body.getBoundingClientRect();

            elements.forEach(el => {
                // 检查是否已有滴水效果
                if (liquidDrips.some(d => d.target === el)) return;
                const style = window.getComputedStyle(el);
                if (style.visibility === 'hidden' || parseFloat(style.opacity) <= 0) return;
                const rect = el.getBoundingClientRect();
                if (rect.width < 10 || rect.height < 10) return;

                const index = liquidDrips.length;
                const isCircle = el.classList.contains('glass-orb');
                const centerX = rect.left - rootRect.left + rect.width / 2;
                const bottomY = rect.top - rootRect.top + rect.height;
                let waveLeft, waveRight, dripX;

                if (isCircle) {
                    const radius = rect.width / 2;
                    const narrowSpan = radius * 0.4;
                    waveLeft = centerX - narrowSpan;
                    waveRight = centerX + narrowSpan;
                    dripX = centerX;
                } else {
                    const indent = Math.min(20, rect.width * 0.15);
                    waveLeft = rect.left - rootRect.left + indent;
                    waveRight = rect.right - rootRect.left - indent;
                    dripX = waveLeft + (waveRight - waveLeft) * (LD_MIN_GATHER_PT + (LD_MAX_GATHER_PT - LD_MIN_GATHER_PT) / 2);
                }

                const scale = Math.min(1.0, Math.max(0.6, rect.width / 300)) * LD_GLOBAL_SCALE;
                const motionPower = 1.8 / scale;
                const motionFactor = 0.6 * scale;
                const terminalVel = 0.6 * scale;
                const accelDist = 0.12 * scale;
                const maxDropDist = 80 * scale;
                const gatheringMs = ldGatheringDuration(rect.width);
                const cycleMs = gatheringMs + LD_BULGING_MS + LD_STRETCHING_MS + LD_PINCH_MS + LD_FALLING_MS;

                const filterId = `ld-goo-${index}`;
                const filter = document.createElementNS(svgNS, 'filter');
                filter.setAttribute('id', filterId);
                const blur = document.createElementNS(svgNS, 'feGaussianBlur');
                blur.setAttribute('in', 'SourceGraphic');
                blur.setAttribute('stdDeviation', '3.5');
                const colorMatrix = document.createElementNS(svgNS, 'feColorMatrix');
                colorMatrix.setAttribute('type', 'matrix');
                colorMatrix.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7');
                filter.appendChild(blur);
                filter.appendChild(colorMatrix);
                defs.appendChild(filter);

                const clipId = `ld-clip-${index}`;
                const clipPathEl = document.createElementNS(svgNS, 'clipPath');
                clipPathEl.setAttribute('id', clipId);
                const clipRect = document.createElementNS(svgNS, 'rect');
                clipRect.setAttribute('x', '-10000');
                clipRect.setAttribute('y', bottomY.toFixed(1));
                clipRect.setAttribute('width', '20000');
                clipRect.setAttribute('height', '20000');
                clipPathEl.appendChild(clipRect);
                defs.appendChild(clipPathEl);

                const cardGroup = document.createElementNS(svgNS, 'g');
                cardGroup.setAttribute('clip-path', `url(#${clipId})`);
                cardGroup.setAttribute('filter', `url(#${filterId})`);

                const path = document.createElementNS(svgNS, 'path');
                path.setAttribute('fill', 'rgba(170, 215, 255, 0.7)');
                cardGroup.appendChild(path);
                const bulge = document.createElementNS(svgNS, 'circle');
                bulge.setAttribute('fill', 'rgba(170, 215, 255, 0.7)');
                cardGroup.appendChild(bulge);
                const droplet = document.createElementNS(svgNS, 'path');
                droplet.setAttribute('fill', 'rgba(170, 215, 255, 0.6)');
                cardGroup.appendChild(droplet);
                svgGroup.appendChild(cardGroup);

                let collisionY = 10000;
                liquidDrips.forEach(other => {
                    if (!other.target) return;
                    const otherRect = other.target.getBoundingClientRect();
                    if (otherRect.top >= bottomY - 2 && dripX >= otherRect.left - rootRect.left && dripX <= otherRect.right - rootRect.left) {
                        if (otherRect.top - rootRect.top < collisionY) {
                            collisionY = otherRect.top - rootRect.top;
                        }
                    }
                });

                liquidDrips.push({
                    target: el,
                    index,
                    elapsed: 0,
                    phaseOffset: index * 1200,
                    waveLeft, waveRight, dripX,
                    gatheringMs, cycleMs,
                    targetBottom: bottomY,
                    isCircle,
                    scale,
                    motionPower, motionFactor, terminalVel, accelDist, maxDropDist,
                    collisionY,
                    hasSplashed: false,
                    cardGroup, path, bulge, droplet, clipRect, blur,
                    lastPathD: null,
                    flatPathD: null,
                });
            });

            if (liquidDrips.length > 0 && !liquidDripAnimId) {
                startLiquidDripAnimation();
            }
        }

        // 移除指定元素的滴水效果（用于 modal 关闭时）
        function removeLiquidDripForElement(element) {
            const idx = liquidDrips.findIndex(d => d.target === element);
            if (idx < 0) return;
            const d = liquidDrips[idx];
            // 从 SVG 中移除对应的 DOM 节点
            if (d.cardGroup && d.cardGroup.parentNode) d.cardGroup.parentNode.removeChild(d.cardGroup);
            // 从数组中移除
            liquidDrips.splice(idx, 1);
        }

        function startLiquidDripAnimation() {
            if (liquidDripAnimId) return;
            let lastTime = performance.now();
            function loop(now) {
                if (!liquidDripActive || liquidDrips.length === 0) {
                    liquidDripAnimId = null;
                    return;
                }
                const delta = Math.min(0.1, (now - lastTime) / 1000);
                lastTime = now;
                updateLiquidDrips(delta);
                liquidDripAnimId = requestAnimationFrame(loop);
            }
            liquidDripAnimId = requestAnimationFrame(loop);
        }

        function updateLiquidDrips(deltaSeconds) {
            const svgGroup = liquidDripSvg?.querySelector('g');
            if (!svgGroup) return;

            // 每帧实时更新所有滴水位置（跟随视差移动）
            const rootRect = document.body.getBoundingClientRect();
            const now = performance.now();
            for (let i = 0; i < liquidDrips.length; i++) {
                const d = liquidDrips[i];
                if (!d.target) continue;
                // 每 500ms 检查一次可见性（避免每帧调用 getComputedStyle）
                if (!d._lastVisCheck || now - d._lastVisCheck > 500) {
                    const tStyle = window.getComputedStyle(d.target);
                    d._isTargetHidden = tStyle.visibility === 'hidden' || parseFloat(tStyle.opacity) <= 0 || tStyle.display === 'none';
                    // 也检查是否在视口外（如 break-board 被移出屏幕）
                    if (!d._isTargetHidden) {
                        const tRect = d.target.getBoundingClientRect();
                        d._isTargetHidden = tRect.bottom < 0 || tRect.top > window.innerHeight || tRect.right < 0 || tRect.left > window.innerWidth;
                    }
                    d._lastVisCheck = now;
                }
                if (d._isTargetHidden) {
                    d.path.setAttribute('d', '');
                    d.bulge.setAttribute('r', '0');
                    d.droplet.setAttribute('d', '');
                    continue;
                }
                const rect = d.target.getBoundingClientRect();
                if (rect.width < 10 || rect.height < 10 || rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
                    // 元素不可见（display:none 等）或不在视口内，清空 SVG 防止残留
                    d.path.setAttribute('d', '');
                    d.bulge.setAttribute('r', '0');
                    d.droplet.setAttribute('d', '');
                    continue;
                }
                const centerX = rect.left - rootRect.left + rect.width / 2;
                d.targetBottom = rect.top - rootRect.top + rect.height;

                if (d.isCircle) {
                    // 圆形：滴水在圆心正下方，波形区域窄
                    const radius = rect.width / 2;
                    const narrowSpan = radius * 0.4;
                    d.waveLeft = centerX - narrowSpan;
                    d.waveRight = centerX + narrowSpan;
                    d.dripX = centerX;
                } else {
                    // 矩形：波形覆盖底边
                    const indent = Math.min(20, rect.width * 0.15);
                    d.waveLeft = rect.left - rootRect.left + indent;
                    d.waveRight = rect.right - rootRect.left - indent;
                    // 保持 dripX 在波形区域内，且相对位置不变
                    const span = d.waveRight - d.waveLeft;
                    if (span > 0) {
                        if (d.dripX < d.waveLeft || d.dripX > d.waveRight) {
                            // dripX 超出范围（如初始 modal 隐藏时），重新设在中间
                            d.dripX = d.waveLeft + span * (LD_MIN_GATHER_PT + (LD_MAX_GATHER_PT - LD_MIN_GATHER_PT) / 2);
                        }
                    }
                }
                d.flatPathD = null;
                d.lastPathD = null;
                d.clipRect.setAttribute('y', d.targetBottom.toFixed(1));

                // 重新计算碰撞目标
                let collisionY = 10000;
                for (let j = 0; j < liquidDrips.length; j++) {
                    if (j === i) continue;
                    const other = liquidDrips[j];
                    if (!other.target) continue;
                    const otherRect = other.target.getBoundingClientRect();
                    if (otherRect.top >= d.targetBottom - 2 && d.dripX >= otherRect.left - rootRect.left && d.dripX <= otherRect.right - rootRect.left) {
                        if (otherRect.top - rootRect.top < collisionY) {
                            collisionY = otherRect.top - rootRect.top;
                        }
                    }
                }
                d.collisionY = collisionY;
            }

            for (let i = 0; i < liquidDrips.length; i++) {
                const d = liquidDrips[i];
                const leftSpan = d.dripX - d.waveLeft;
                const rightSpan = d.waveRight - d.dripX;
                if (leftSpan <= 0 || rightSpan <= 0) {
                    d.path.setAttribute('d', '');
                    d.bulge.setAttribute('r', '0');
                    d.droplet.setAttribute('d', '');
                    continue;
                }

                d.elapsed += deltaSeconds * 1000;
                const elapsedMs = (d.elapsed + d.phaseOffset) % d.cycleMs;

                const gatherEndMs = d.gatheringMs;
                const bulgeEndMs = gatherEndMs + LD_BULGING_MS;
                const stretchEndMs = bulgeEndMs + LD_STRETCHING_MS;
                const pinchEndMs = stretchEndMs + LD_PINCH_MS;
                const fallEndMs = pinchEndMs + LD_FALLING_MS;
                const splashEndMs = fallEndMs + LD_SPLASH_MS;

                const isOutsideGoo = elapsedMs >= stretchEndMs;
                const scale = d.scale;

                // 水滴形状进度
                const shapeProgress = Math.min(1, Math.max(0, (elapsedMs - bulgeEndMs) / (LD_STRETCHING_MS + LD_PINCH_MS)));
                const lengthScale = 1 + (LD_DROPLET_LENGTH_SCALE - 1) * ldEaseInOutQuad(shapeProgress);
                const activeRX = (LD_DROPLET_START_RX + (LD_DROPLET_END_RX - LD_DROPLET_START_RX) * shapeProgress) * scale;
                const activeRY = (LD_DROPLET_START_RY + (LD_DROPLET_END_RY - LD_DROPLET_START_RY) * shapeProgress) * lengthScale * scale;

                // 水滴运动偏移
                const motionElapsed = Math.min(LD_MOTION_DURATION_S, Math.max(0, (elapsedMs - bulgeEndMs) / 1000));
                const dropOffset = motionElapsed <= LD_ACCEL_DURATION_S
                    ? d.motionFactor * Math.pow(motionElapsed, d.motionPower)
                    : d.accelDist + d.terminalVel * (motionElapsed - LD_ACCEL_DURATION_S);
                const dropStartY = d.targetBottom - 2 + 4.0 * scale;
                const dropY = dropStartY + dropOffset;

                let bulgeR = 0, bulgeCY = d.targetBottom - 2;
                let dropletRX = 0, dropletRY = 0, dropletCY = d.targetBottom - 2;
                let baseAmp = 1.8;

                if (elapsedMs < gatherEndMs) {
                    // Phase 1: Gathering
                    const p = ldEaseInQuad(elapsedMs / gatherEndMs);
                    bulgeR = p * 4.0 * scale;
                    bulgeCY = d.targetBottom - 2 + p * 2.0 * scale;
                    d.hasSplashed = false;
                } else if (elapsedMs < bulgeEndMs) {
                    // Phase 2: Bulging
                    const p = ldEaseOutQuad((elapsedMs - gatherEndMs) / LD_BULGING_MS);
                    bulgeR = (4.0 + p * 4.0) * scale;
                    bulgeCY = d.targetBottom - 2 + (2.0 + p * 2.0) * scale;
                    baseAmp = 1.8 + p * 0.4;
                } else if (elapsedMs < stretchEndMs) {
                    // Phase 3: Stretching
                    const p = ldEaseInOutQuad((elapsedMs - bulgeEndMs) / LD_STRETCHING_MS);
                    const inStretch = elapsedMs - bulgeEndMs;
                    if (inStretch < 200) {
                        const ep = ldEaseInOutQuad(inStretch / 200);
                        bulgeR = (8.0 + ep * 0.5) * scale;
                        bulgeCY = d.targetBottom - 2 + (4.0 + ep * 1.0) * scale;
                    } else {
                        const ep = ldEaseInOutQuad((inStretch - 200) / 450);
                        bulgeR = (8.5 - ep * 3.5) * scale;
                        bulgeCY = d.targetBottom - 2 + (5.0 - ep * 2.0) * scale;
                    }
                    dropletRX = activeRX;
                    dropletRY = activeRY;
                    dropletCY = dropY;
                    baseAmp = 2.2 + p * 1.3;
                } else if (elapsedMs < pinchEndMs) {
                    // Phase 4: Pinch-off
                    bulgeR = 5.0 * scale;
                    bulgeCY = d.targetBottom - 2 + 3.0 * scale;
                    dropletRX = activeRX;
                    dropletRY = activeRY;
                    dropletCY = dropY;
                    baseAmp = 3.5;
                } else if (elapsedMs < fallEndMs) {
                    // Phase 5: Falling
                    if (dropY >= d.collisionY) {
                        if (!d.hasSplashed) {
                            d.hasSplashed = true;
                            if (rainFallCanvas) {
                                spawnSplash(d.dripX, d.collisionY, 0, 1, 0, -1);
                            }
                        }
                        dropletRX = 0;
                        dropletRY = 0;
                    } else {
                        dropletRX = activeRX;
                        dropletRY = activeRY;
                        dropletCY = dropY;
                    }
                    const wobbleProg = (elapsedMs - pinchEndMs) / LD_RECOIL_MS;
                    const decay = Math.max(0, 1 - wobbleProg);
                    bulgeR = Math.max(0, 5.0 * decay * scale);
                    bulgeCY = d.targetBottom - 2 + Math.cos(wobbleProg * LD_RECOIL_ROTATION) * 3.0 * decay * scale;
                    baseAmp = 0;
                } else if (elapsedMs < splashEndMs) {
                    // Phase 6: Splash
                    if (!d.hasSplashed) {
                        d.hasSplashed = true;
                        if (rainFallCanvas) {
                            spawnSplash(d.dripX, d.collisionY, 0, 1, 0, -1);
                        }
                    }
                    dropletRX = 0;
                    dropletRY = 0;
                    const wobbleProg = (elapsedMs - pinchEndMs) / LD_RECOIL_MS;
                    const decay = Math.max(0, 1 - wobbleProg);
                    bulgeR = Math.max(0, 5.0 * decay * scale);
                    bulgeCY = d.targetBottom - 2 + Math.cos(wobbleProg * LD_RECOIL_ROTATION) * 3.0 * decay * scale;
                    baseAmp = 0;
                } else {
                    // Phase 7: Cooldown
                    const wobbleProg = (elapsedMs - pinchEndMs) / LD_RECOIL_MS;
                    const decay = Math.max(0, 1 - wobbleProg);
                    bulgeR = Math.max(0, 5.0 * decay * scale);
                    bulgeCY = d.targetBottom - 2 + Math.cos(wobbleProg * LD_RECOIL_ROTATION) * 3.0 * decay * scale;
                    baseAmp = 0;
                }

                // 切换水滴的父节点（离开gooey滤镜后）
                const desiredParent = isOutsideGoo ? svgGroup : d.cardGroup;
                if (d.droplet.parentNode !== desiredParent) {
                    desiredParent.appendChild(d.droplet);
                    if (isOutsideGoo) {
                        d.droplet.setAttribute('clip-path', d.cardGroup.getAttribute('clip-path') || '');
                    } else {
                        d.droplet.removeAttribute('clip-path');
                    }
                }

                // 波形路径计算
                const gatherProgress = ldEaseInOutQuad(Math.min(1, elapsedMs / d.gatheringMs));
                const leftWaveStartX = d.waveLeft + (d.dripX - d.waveLeft) * 0.208;
                const rightWaveStartX = d.waveRight - (d.waveRight - d.dripX) * 0.514;
                const leftCenter = ldWaveCenter(leftWaveStartX, d.dripX, gatherProgress);
                const rightCenter = ldWaveCenter(rightWaveStartX, d.dripX, gatherProgress);
                const basePulseW = 85 * scale;
                const targetPulseW = 45 * scale;
                const pulseW = basePulseW - gatherProgress * (basePulseW - targetPulseW);
                const formation = ldEaseOutQuad(Math.min(1, elapsedMs / LD_WAVE_FORM_MS));
                const releaseFade = 1 - ldEaseInQuad(Math.max(0, (elapsedMs - bulgeEndMs) / (pinchEndMs - bulgeEndMs)));
                const scaledAmp = baseAmp * scale;
                const waveSpan = d.waveRight - d.waveLeft;

                let pathD = '';
                if (scaledAmp === 0) {
                    if (d.flatPathD) {
                        pathD = d.flatPathD;
                    } else {
                        const wl = d.waveLeft.toFixed(1), wr = d.waveRight.toFixed(1);
                        const yb = (d.targetBottom - 20).toFixed(1), yv = (d.targetBottom - 1.0).toFixed(1);
                        pathD = `M ${wl},${yb} L ${wl},${yv} L ${wr},${yv} L ${wr},${yb} Z`;
                        d.flatPathD = pathD;
                    }
                } else {
                    // 17点采样 + 动态关键点
                    const progs = [0, 0.0714, 0.1429, 0.2143, 0.2857, 0.3571, 0.4286, 0.5, 0.5714, 0.625, 0.6875, 0.7411, 0.7946, 0.8393, 0.8929, 0.9464, 1.0];
                    const leftCP = (leftCenter - d.waveLeft) / waveSpan;
                    const rightCP = (rightCenter - d.waveLeft) / waveSpan;
                    const pp = pulseW / waveSpan;
                    // 添加动态关键点
                    const extras = [leftCP, leftCP - pp, leftCP + pp, rightCP, rightCP - pp, rightCP + pp];
                    const allProgs = [...progs];
                    for (const ep of extras) {
                        if (ep > 0 && ep < 1 && !allProgs.some(p => Math.abs(p - ep) < 0.005)) {
                            allProgs.push(ep);
                        }
                    }
                    allProgs.sort((a, b) => a - b);

                    const pts = allProgs.map(prog => {
                        const x = d.waveLeft + prog * waveSpan;
                        let y = d.targetBottom - 1.0;
                        if (prog > 0 && prog < 1) {
                            y += ldWaveY(x, d.dripX, leftCenter, rightCenter, pulseW, scaledAmp, formation, releaseFade);
                        }
                        return { x, y };
                    });

                    const wl = d.waveLeft.toFixed(1), wr = d.waveRight.toFixed(1);
                    const yb = (d.targetBottom - 20).toFixed(1);
                    let segs = [`M ${wl},${yb} L ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} `];
                    for (let j = 0; j < pts.length - 1; j++) {
                        const p0 = pts[Math.max(0, j - 1)];
                        const p1 = pts[j];
                        const p2 = pts[j + 1];
                        const p3 = pts[Math.min(pts.length - 1, j + 2)];
                        const cp1x = p1.x + (p2.x - p0.x) / 6;
                        const cp1y = p1.y + (p2.y - p0.y) / 6;
                        const cp2x = p2.x - (p3.x - p1.x) / 6;
                        const cp2y = p2.y - (p3.y - p1.y) / 6;
                        segs.push(`C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)} `);
                    }
                    segs.push(`L ${wr},${yb} Z`);
                    pathD = segs.join('');
                }

                if (d.lastPathD !== pathD) {
                    d.path.setAttribute('d', pathD);
                    d.lastPathD = pathD;
                }

                d.bulge.setAttribute('cx', d.dripX.toFixed(1));
                d.bulge.setAttribute('cy', bulgeCY.toFixed(1));
                d.bulge.setAttribute('r', bulgeR.toFixed(1));

                // 水滴渲染
                const filterExitProg = Math.min(1, Math.max(0, (elapsedMs - stretchEndMs) / LD_PINCH_MS));
                const detachedLenScale = LD_DETACHED_START_LENGTH + (LD_DETACHED_END_LENGTH - LD_DETACHED_START_LENGTH) * ldEaseInOutQuad(filterExitProg);
                const vsX = isOutsideGoo ? LD_DETACHED_WIDTH_SCALE : 1;
                const vsY = isOutsideGoo ? detachedLenScale : 1;
                const renderedRY = dropletRY * vsY;
                const lowerHalfRY = isOutsideGoo ? dropletRY * LD_DETACHED_START_LENGTH : renderedRY;
                const renderedCY = dropletCY - (renderedRY - lowerHalfRY);
                const w = dropletRX * vsX;
                const h = renderedRY;

                if (w <= 0 || h <= 0) {
                    d.droplet.setAttribute('d', `M ${d.dripX.toFixed(1)},${renderedCY.toFixed(1)}`);
                } else {
                    const x = d.dripX, y = renderedCY;
                    const xw = x + w, xmw = x - w;
                    const yh = y + h, ymh = y - h;
                    d.droplet.setAttribute('d',
                        `M ${x.toFixed(1)},${ymh.toFixed(1)} ` +
                        `C ${(x + 0.2 * w).toFixed(1)},${ymh.toFixed(1)} ${xw.toFixed(1)},${(y - 0.3 * h).toFixed(1)} ${xw.toFixed(1)},${(y + 0.3 * h).toFixed(1)} ` +
                        `C ${xw.toFixed(1)},${(y + 0.7 * h).toFixed(1)} ${(x + 0.5 * w).toFixed(1)},${yh.toFixed(1)} ${x.toFixed(1)},${yh.toFixed(1)} ` +
                        `C ${(x - 0.5 * w).toFixed(1)},${yh.toFixed(1)} ${xmw.toFixed(1)},${(y + 0.7 * h).toFixed(1)} ${xmw.toFixed(1)},${(y + 0.3 * h).toFixed(1)} ` +
                        `C ${xmw.toFixed(1)},${(y - 0.3 * h).toFixed(1)} ${(x - 0.2 * w).toFixed(1)},${ymh.toFixed(1)} ${x.toFixed(1)},${ymh.toFixed(1)} Z`
                    );
                }
            }
        }

        function removeLiquidDripEffects() {
            liquidDripActive = false;
            window.removeEventListener('resize', updateLiquidDripPositions);
            if (liquidDripAnimId) {
                cancelAnimationFrame(liquidDripAnimId);
                liquidDripAnimId = null;
            }
            if (liquidDripSvg) {
                liquidDripSvg.remove();
                liquidDripSvg = null;
            }
            liquidDrips = [];
        }

        function updateLiquidDripPositions() {
            // 每帧已经在 updateLiquidDrips 中实时更新位置，此函数保留用于 resize 时的额外刷新
            // 实际位置更新逻辑已移至 updateLiquidDrips 的开头
        }

        function updateRainFallSettings() {
            const settings = getSettings();
            const densityScale = settings.rainFallDensity / 100;
            const sizeScale = settings.rainFallSize / 100;
            const speedScale = settings.rainFallSpeed / 100;
            const splashScale = settings.splashIntensity / 100;

            // 更新雨丝数量
            const targetCount = Math.round(RAIN_FALL_COUNT * densityScale);
            while (rainDrops.length < targetCount) {
                rainDrops.push({
                    x: Math.random() * (rainFallCanvas ? rainFallCanvas.width : window.innerWidth),
                    y: Math.random() * (rainFallCanvas ? rainFallCanvas.height : window.innerHeight) * -1,
                    length: (10 + Math.random() * 20) * sizeScale,
                    speed: (4 + Math.random() * 8) * speedScale,
                    opacity: 0.1 + Math.random() * 0.3,
                    width: (0.5 + Math.random() * 1) * sizeScale
                });
            }
            while (rainDrops.length > targetCount) {
                rainDrops.pop();
            }

            // 更新已有雨丝的大小和速度
            for (const drop of rainDrops) {
                drop.length = (10 + Math.random() * 20) * sizeScale;
                drop.speed = (4 + Math.random() * 8) * speedScale;
                drop.width = (0.5 + Math.random() * 1) * sizeScale;
            }

            // 更新飞溅强度
            SPLASH_PARTICLES_PER_HIT_CURRENT = Math.round(SPLASH_PARTICLES_PER_HIT * splashScale);
        }

        function showSettingsModal() {
            document.getElementById('settingsModal').classList.add('active');
            loadSettings();
        }

        function loadSettings() {
            const settings = getSettings();
            document.getElementById('autoFullscreen').checked = settings.autoFullscreen;
            const restReminderTime = document.getElementById('restReminderTime');
            if (restReminderTime) {
                restReminderTime.value = settings.restReminderTime;
            }
            const screenWakeTime = document.getElementById('screenWakeTime');
            if (screenWakeTime) {
                screenWakeTime.value = settings.screenWakeTime;
            }
            const volumeSlider = document.getElementById('volumeSlider');
            const volumeValue = document.getElementById('volumeValue');
            if (volumeSlider && volumeValue) {
                volumeSlider.value = settings.volume;
                volumeValue.textContent = settings.volume + '%';
            }
            audioTargetVolume = settings.volume / 100;
            if (!audioFadingOut) {
                document.getElementById('bgMusic').volume = audioTargetVolume;
            }
            // 环境特效总开关
            const envFxEnabled = document.getElementById('envFxEnabled');
            if (envFxEnabled) {
                envFxEnabled.checked = settings.envFxEnabled;
            }
            updateEnvFxParamsRow();
            // 云雾效果开关
            const thunderCloudEnabled = document.getElementById('thunderCloudEnabled');
            if (thunderCloudEnabled) {
                thunderCloudEnabled.checked = settings.thunderCloudEnabled;
            }
            updateThunderCloudParamsRow();
            // 雷雨云设置
            const thunderCloudSlider = document.getElementById('thunderCloudSlider');
            const thunderCloudValue = document.getElementById('thunderCloudValue');
            if (thunderCloudSlider && thunderCloudValue) {
                thunderCloudSlider.value = settings.thunderCloudAmount;
                thunderCloudValue.textContent = settings.thunderCloudAmount + '%';
            }
            const thunderFogSlider = document.getElementById('thunderFogSlider');
            const thunderFogValue = document.getElementById('thunderFogValue');
            if (thunderFogSlider && thunderFogValue) {
                thunderFogSlider.value = settings.thunderCloudFog;
                thunderFogValue.textContent = settings.thunderCloudFog + '%';
            }
            const thunderCloudOpacitySlider = document.getElementById('thunderCloudOpacitySlider');
            const thunderCloudOpacityValue = document.getElementById('thunderCloudOpacityValue');
            if (thunderCloudOpacitySlider && thunderCloudOpacityValue) {
                thunderCloudOpacitySlider.value = settings.thunderCloudOpacity;
                thunderCloudOpacityValue.textContent = settings.thunderCloudOpacity + '%';
            }
            const thunderCloudThicknessSlider = document.getElementById('thunderCloudThicknessSlider');
            const thunderCloudThicknessValue = document.getElementById('thunderCloudThicknessValue');
            if (thunderCloudThicknessSlider && thunderCloudThicknessValue) {
                thunderCloudThicknessSlider.value = settings.thunderCloudThickness;
                thunderCloudThicknessValue.textContent = settings.thunderCloudThickness + '%';
            }
            const thunderCloudClusteringSlider = document.getElementById('thunderCloudClusteringSlider');
            const thunderCloudClusteringValue = document.getElementById('thunderCloudClusteringValue');
            if (thunderCloudClusteringSlider && thunderCloudClusteringValue) {
                thunderCloudClusteringSlider.value = settings.thunderCloudClustering;
                thunderCloudClusteringValue.textContent = settings.thunderCloudClustering + '%';
            }
            const thunderCloudSpeedSlider = document.getElementById('thunderCloudSpeedSlider');
            const thunderCloudSpeedValue = document.getElementById('thunderCloudSpeedValue');
            if (thunderCloudSpeedSlider && thunderCloudSpeedValue) {
                thunderCloudSpeedSlider.value = settings.thunderCloudSpeed;
                thunderCloudSpeedValue.textContent = settings.thunderCloudSpeed + '%';
            }
            const thunderCloudBrightnessSlider = document.getElementById('thunderCloudBrightnessSlider');
            const thunderCloudBrightnessValue = document.getElementById('thunderCloudBrightnessValue');
            if (thunderCloudBrightnessSlider && thunderCloudBrightnessValue) {
                thunderCloudBrightnessSlider.value = settings.thunderCloudBrightness;
                thunderCloudBrightnessValue.textContent = settings.thunderCloudBrightness + '%';
            }
            const thunderLightningSlider = document.getElementById('thunderLightningSlider');
            const thunderLightningValue = document.getElementById('thunderLightningValue');
            if (thunderLightningSlider && thunderLightningValue) {
                thunderLightningSlider.value = settings.thunderLightningFreq;
                thunderLightningValue.textContent = thunderLightningLabel(settings.thunderLightningFreq);
            }
            const thunderQualitySlider = document.getElementById('thunderQualitySlider');
            const thunderQualityValue = document.getElementById('thunderQualityValue');
            if (thunderQualitySlider && thunderQualityValue) {
                thunderQualitySlider.value = settings.thunderCloudQuality;
                thunderQualityValue.textContent = thunderQualityLabel(settings.thunderCloudQuality);
            }
            // 雨滴效果开关
            const rainCardEnabled = document.getElementById('rainCardEnabled');
            if (rainCardEnabled) {
                rainCardEnabled.checked = settings.rainCardEnabled;
            }
            if (typeof updateRainCardParamsRow === 'function') updateRainCardParamsRow();
            // 雨滴参数
            const rainCardDensitySlider = document.getElementById('rainCardDensitySlider');
            const rainCardDensityValue = document.getElementById('rainCardDensityValue');
            if (rainCardDensitySlider && rainCardDensityValue) {
                rainCardDensitySlider.value = settings.rainCardDensity;
                rainCardDensityValue.textContent = settings.rainCardDensity + '%';
            }
            const rainCardDropSizeSlider = document.getElementById('rainCardDropSizeSlider');
            const rainCardDropSizeValue = document.getElementById('rainCardDropSizeValue');
            if (rainCardDropSizeSlider && rainCardDropSizeValue) {
                rainCardDropSizeSlider.value = settings.rainCardDropSize;
                rainCardDropSizeValue.textContent = settings.rainCardDropSize + '%';
            }
            const rainCardRefractionSlider = document.getElementById('rainCardRefractionSlider');
            const rainCardRefractionValue = document.getElementById('rainCardRefractionValue');
            if (rainCardRefractionSlider && rainCardRefractionValue) {
                rainCardRefractionSlider.value = settings.rainCardRefraction;
                rainCardRefractionValue.textContent = settings.rainCardRefraction + '%';
            }
            const rainCardBrightnessSlider = document.getElementById('rainCardBrightnessSlider');
            const rainCardBrightnessValue = document.getElementById('rainCardBrightnessValue');
            if (rainCardBrightnessSlider && rainCardBrightnessValue) {
                rainCardBrightnessSlider.value = settings.rainCardBrightness;
                rainCardBrightnessValue.textContent = settings.rainCardBrightness + '%';
            }
            const rainFallEnabled = document.getElementById('rainFallEnabled');
            if (rainFallEnabled) {
                rainFallEnabled.checked = settings.rainFallEnabled;
            }
            if (typeof updateRainFallParamsRow === 'function') updateRainFallParamsRow();
            const rainFallDensitySlider = document.getElementById('rainFallDensitySlider');
            const rainFallDensityValue = document.getElementById('rainFallDensityValue');
            if (rainFallDensitySlider && rainFallDensityValue) {
                rainFallDensitySlider.value = settings.rainFallDensity;
                rainFallDensityValue.textContent = settings.rainFallDensity + '%';
            }
            const rainFallSizeSlider = document.getElementById('rainFallSizeSlider');
            const rainFallSizeValue = document.getElementById('rainFallSizeValue');
            if (rainFallSizeSlider && rainFallSizeValue) {
                rainFallSizeSlider.value = settings.rainFallSize;
                rainFallSizeValue.textContent = settings.rainFallSize + '%';
            }
            const splashIntensitySlider = document.getElementById('splashIntensitySlider');
            const splashIntensityValue = document.getElementById('splashIntensityValue');
            if (splashIntensitySlider && splashIntensityValue) {
                splashIntensitySlider.value = settings.splashIntensity;
                splashIntensityValue.textContent = settings.splashIntensity + '%';
            }
            const rainFallSpeedSlider = document.getElementById('rainFallSpeedSlider');
            const rainFallSpeedValue = document.getElementById('rainFallSpeedValue');
            if (rainFallSpeedSlider && rainFallSpeedValue) {
                rainFallSpeedSlider.value = settings.rainFallSpeed;
                rainFallSpeedValue.textContent = settings.rainFallSpeed + '%';
            }
            // 冷气白雾设置
            const acMistEnabled = document.getElementById('acMistEnabled');
            if (acMistEnabled) {
                acMistEnabled.checked = settings.acMistEnabled;
            }
            const acMistIntensitySlider = document.getElementById('acMistIntensitySlider');
            const acMistIntensityValue = document.getElementById('acMistIntensityValue');
            if (acMistIntensitySlider && acMistIntensityValue) {
                acMistIntensitySlider.value = settings.acMistIntensity;
                acMistIntensityValue.textContent = settings.acMistIntensity + '%';
            }
            const acMistSpeedSlider = document.getElementById('acMistSpeedSlider');
            const acMistSpeedValue = document.getElementById('acMistSpeedValue');
            if (acMistSpeedSlider && acMistSpeedValue) {
                acMistSpeedSlider.value = settings.acMistSpeed;
                acMistSpeedValue.textContent = settings.acMistSpeed + '%';
            }
            const acMistSpreadSlider = document.getElementById('acMistSpreadSlider');
            const acMistSpreadValue = document.getElementById('acMistSpreadValue');
            if (acMistSpreadSlider && acMistSpreadValue) {
                acMistSpreadSlider.value = settings.acMistSpread;
                acMistSpreadValue.textContent = settings.acMistSpread + '%';
            }
            const acMistLengthSlider = document.getElementById('acMistLengthSlider');
            const acMistLengthValue = document.getElementById('acMistLengthValue');
            if (acMistLengthSlider && acMistLengthValue) {
                acMistLengthSlider.value = settings.acMistLength;
                acMistLengthValue.textContent = settings.acMistLength + '%';
            }
            const acMistAngleSlider = document.getElementById('acMistAngleSlider');
            const acMistAngleValue = document.getElementById('acMistAngleValue');
            if (acMistAngleSlider && acMistAngleValue) {
                acMistAngleSlider.value = settings.acMistAngle;
                acMistAngleValue.textContent = settings.acMistAngle + '°';
            }
            // 篝火光照设置
            const bonfireEnabled = document.getElementById('bonfireEnabled');
            if (bonfireEnabled) {
                bonfireEnabled.checked = settings.bonfireEnabled;
            }
            const bonfireSizeSlider = document.getElementById('bonfireSizeSlider');
            const bonfireSizeValue = document.getElementById('bonfireSizeValue');
            if (bonfireSizeSlider && bonfireSizeValue) {
                bonfireSizeSlider.value = settings.bonfireSize;
                bonfireSizeValue.textContent = settings.bonfireSize + '%';
            }
            const bonfireLightSlider = document.getElementById('bonfireLightSlider');
            const bonfireLightValue = document.getElementById('bonfireLightValue');
            if (bonfireLightSlider && bonfireLightValue) {
                bonfireLightSlider.value = settings.bonfireLight;
                bonfireLightValue.textContent = settings.bonfireLight + '%';
            }
            const bonfireFlickerSlider = document.getElementById('bonfireFlickerSlider');
            const bonfireFlickerValue = document.getElementById('bonfireFlickerValue');
            if (bonfireFlickerSlider && bonfireFlickerValue) {
                bonfireFlickerSlider.value = settings.bonfireFlicker;
                bonfireFlickerValue.textContent = settings.bonfireFlicker + '%';
            }
            const bonfireHeightSlider = document.getElementById('bonfireHeightSlider');
            const bonfireHeightValue = document.getElementById('bonfireHeightValue');
            if (bonfireHeightSlider && bonfireHeightValue) {
                bonfireHeightSlider.value = settings.bonfireHeight;
                bonfireHeightValue.textContent = settings.bonfireHeight + '%';
            }
            // 萤火虫设置
            const fireflyEnabled = document.getElementById('fireflyEnabled');
            if (fireflyEnabled) {
                fireflyEnabled.checked = settings.fireflyEnabled;
            }
            const fireflyDensitySlider = document.getElementById('fireflyDensitySlider');
            const fireflyDensityValue = document.getElementById('fireflyDensityValue');
            if (fireflyDensitySlider && fireflyDensityValue) {
                fireflyDensitySlider.value = settings.fireflyDensity;
                fireflyDensityValue.textContent = settings.fireflyDensity + '%';
            }
            const fireflySizeSlider = document.getElementById('fireflySizeSlider');
            const fireflySizeValue = document.getElementById('fireflySizeValue');
            if (fireflySizeSlider && fireflySizeValue) {
                fireflySizeSlider.value = settings.fireflySize;
                fireflySizeValue.textContent = settings.fireflySize + '%';
            }
            const fireflyGlowSlider = document.getElementById('fireflyGlowSlider');
            const fireflyGlowValue = document.getElementById('fireflyGlowValue');
            if (fireflyGlowSlider && fireflyGlowValue) {
                fireflyGlowSlider.value = settings.fireflyGlow;
                fireflyGlowValue.textContent = settings.fireflyGlow + '%';
            }
            const fireflySpeedSlider = document.getElementById('fireflySpeedSlider');
            const fireflySpeedValue = document.getElementById('fireflySpeedValue');
            if (fireflySpeedSlider && fireflySpeedValue) {
                fireflySpeedSlider.value = settings.fireflySpeed;
                fireflySpeedValue.textContent = settings.fireflySpeed + '%';
            }
            const fireflyBlinkFreqSlider = document.getElementById('fireflyBlinkFreqSlider');
            const fireflyBlinkFreqValue = document.getElementById('fireflyBlinkFreqValue');
            if (fireflyBlinkFreqSlider && fireflyBlinkFreqValue) {
                fireflyBlinkFreqSlider.value = settings.fireflyBlinkFreq;
                fireflyBlinkFreqValue.textContent = settings.fireflyBlinkFreq + '%';
            }
            applyTheme(settings.theme || 'rounded', false);
            applyLightMode(settings.lightMode || 'on');
            updateAcMistParamsRow();
            updateBonfireParamsRow();
            updateFireflyParamsRow();
        }

        function openThunderCloudParams() {
            const row = document.getElementById('thunderCloudParamsRow');
            if (row && row.classList.contains('setting-item-disabled')) return;
            const parentPanel = document.getElementById('envFxParamsPanel');
            const paramsPanel = document.getElementById('thunderCloudParamsPanel');
            if (parentPanel) parentPanel.style.display = 'none';
            if (paramsPanel) paramsPanel.style.display = 'block';
        }

        function closeThunderCloudParams() {
            const parentPanel = document.getElementById('envFxParamsPanel');
            const paramsPanel = document.getElementById('thunderCloudParamsPanel');
            if (paramsPanel) paramsPanel.style.display = 'none';
            if (parentPanel) parentPanel.style.display = 'block';
        }

        function updateThunderCloudParamsRow() {
            const settings = getSettings();
            const row = document.getElementById('thunderCloudParamsRow');
            if (row) {
                if (settings.thunderCloudEnabled && settings.envFxEnabled) {
                    row.classList.remove('setting-item-disabled');
                } else {
                    row.classList.add('setting-item-disabled');
                }
            }
        }

        function openEnvFxParams() {
            const row = document.getElementById('envFxParamsRow');
            if (row && row.classList.contains('setting-item-disabled')) return;
            const mainPanel = document.getElementById('settingsMainPanel');
            const paramsPanel = document.getElementById('envFxParamsPanel');
            if (mainPanel) mainPanel.style.display = 'none';
            if (paramsPanel) paramsPanel.style.display = 'block';
        }

        function closeEnvFxParams() {
            const mainPanel = document.getElementById('settingsMainPanel');
            const paramsPanel = document.getElementById('envFxParamsPanel');
            if (paramsPanel) paramsPanel.style.display = 'none';
            if (mainPanel) mainPanel.style.display = 'block';
        }

        // ==================== 自定义壁纸管理（IndexedDB） ====================
        const DEFAULT_ON_IMG = "url('壁纸-学习模式.png')";
        const DEFAULT_OFF_IMG = "url('壁纸-休息模式.png')";
        const STATIC_EXTS = ['jpg','jpeg','png','webp','bmp','svg','avif'];
        const DYNAMIC_EXTS = ['gif'];
        const VIDEO_EXTS = ['mp4','webm','ogg','mov'];
        const WP_DB_NAME = 'StudyRoomWallpapers';
        const WP_DB_VERSION = 1;
        const WP_STORE = 'wallpapers';

        let wallpaperCurrentTab = 'static';
        let wallpaperChoosingSlot = null;
        // 内存缓存：元数据列表（不含 Blob，轻量）
        let _wpCache = null;

        // ---- IndexedDB 封装 ----
        function wpOpenDB() {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(WP_DB_NAME, WP_DB_VERSION);
                req.onupgradeneeded = e => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(WP_STORE)) {
                        db.createObjectStore(WP_STORE, { keyPath: 'id' });
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }

        async function wpGetAllMeta() {
            if (_wpCache) return _wpCache;
            const db = await wpOpenDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(WP_STORE, 'readonly');
                const store = tx.objectStore(WP_STORE);
                const req = store.getAll();
                req.onsuccess = () => {
                    // 只取元数据，不含 blob
                    const list = req.result.map(r => ({
                        id: r.id, name: r.name, type: r.type || 'static', thumb: r.thumb
                    }));
                    _wpCache = list;
                    resolve(list);
                };
                req.onerror = () => reject(req.error);
            });
        }

        async function wpGetById(id) {
            const db = await wpOpenDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(WP_STORE, 'readonly');
                const req = tx.objectStore(WP_STORE).get(id);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
        }

        async function wpAdd(record) {
            const db = await wpOpenDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(WP_STORE, 'readwrite');
                tx.objectStore(WP_STORE).put(record);
                tx.oncomplete = () => {
                    _wpCache = null; // 清缓存
                    resolve();
                };
                tx.onerror = () => reject(tx.error);
            });
        }

        async function wpDelete(id) {
            const db = await wpOpenDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(WP_STORE, 'readwrite');
                tx.objectStore(WP_STORE).delete(id);
                tx.oncomplete = () => {
                    _wpCache = null;
                    resolve();
                };
                tx.onerror = () => reject(tx.error);
            });
        }

        // 从 localStorage 旧数据迁移到 IndexedDB
        async function migrateWallpapersFromLS() {
            const raw = localStorage.getItem('customWallpapers');
            if (!raw) return;
            try {
                const list = JSON.parse(raw);
                if (!Array.isArray(list) || list.length === 0) return;
                for (const wp of list) {
                    if (!wp.id || !wp.data) continue;
                    // base64 data URL → Blob
                    const blob = dataURLtoBlob(wp.data);
                    await wpAdd({ id: wp.id, name: wp.name, type: wp.type || 'static', thumb: wp.thumb || '', blob });
                }
                localStorage.removeItem('customWallpapers');
                console.log(`已迁移 ${list.length} 张壁纸到 IndexedDB`);
            } catch (e) {
                console.error('壁纸迁移失败:', e);
            }
        }

        function dataURLtoBlob(dataUrl) {
            const parts = dataUrl.split(',');
            const mime = parts[0].match(/:(.*?);/)[1];
            const b64 = atob(parts[1]);
            const arr = new Uint8Array(b64.length);
            for (let i = 0; i < b64.length; i++) arr[i] = b64.charCodeAt(i);
            return new Blob([arr], { type: mime });
        }

        // 初始化：迁移 + 应用当前壁纸
        async function initWallpaperDB() {
            await migrateWallpapersFromLS();
            applyCurrentWallpaper();
        }

        // ---- 壁纸配置（仍存 localStorage，体积极小） ----
        function getWallpaperConfig() {
            try {
                const cfg = JSON.parse(localStorage.getItem('wallpaperConfig') || '{}');
                return { on: cfg.on || 'default', off: cfg.off || 'default', same: cfg.same || false };
            } catch { return { on: 'default', off: 'default', same: false }; }
        }

        function saveWallpaperConfig(cfg) {
            localStorage.setItem('wallpaperConfig', JSON.stringify(cfg));
        }

        // ---- 面板操作 ----
        async function openWallpaperPanel() {
            const mainPanel = document.getElementById('settingsMainPanel');
            const panel = document.getElementById('wallpaperPanel');
            const modal = document.querySelector('.settings-modal-content');
            if (mainPanel) mainPanel.style.display = 'none';
            if (panel) panel.style.display = 'block';
            if (modal) modal.classList.add('wallpaper-expanded');
            wallpaperChoosingSlot = null;
            await renderWallpaperGallery();
            refreshWallpaperSlots();
        }

        function closeWallpaperPanel() {
            const mainPanel = document.getElementById('settingsMainPanel');
            const panel = document.getElementById('wallpaperPanel');
            const modal = document.querySelector('.settings-modal-content');
            if (panel) panel.style.display = 'none';
            if (mainPanel) mainPanel.style.display = 'block';
            if (modal) modal.classList.remove('wallpaper-expanded');
        }

        // ==================== 词条管理 ====================

        function getStudyCategories() {
            try {
                const saved = localStorage.getItem('studyCategories');
                return saved ? JSON.parse(saved) : {};
            } catch (e) {
                return {};
            }
        }

        function saveStudyCategories(categories) {
            localStorage.setItem('studyCategories', JSON.stringify(categories));
        }

        // 获取词条所属的一级类别（用于饼状图）
        function getEntryCategory(entry) {
            const categories = getStudyCategories();
            for (const [catName, entries] of Object.entries(categories)) {
                if (entries.includes(entry)) return catName;
            }
            return entry; // 未归类则自身就是类别
        }

        function openEntryManager() {
            const mainPanel = document.getElementById('settingsMainPanel');
            const panel = document.getElementById('entryManagerPanel');
            if (mainPanel) mainPanel.style.display = 'none';
            if (panel) panel.style.display = 'block';
            renderEntryManager();
        }

        function closeEntryManager() {
            const mainPanel = document.getElementById('settingsMainPanel');
            const panel = document.getElementById('entryManagerPanel');
            if (panel) panel.style.display = 'none';
            if (mainPanel) mainPanel.style.display = 'block';
        }

        function renderEntryManager() {
            const body = document.getElementById('entryManagerBody');
            if (!body) return;
            const types = loadStudyTypes();
            const categories = getStudyCategories();

            // 找出已归类的词条和未归类的词条
            const categorizedEntries = new Set();
            for (const entries of Object.values(categories)) {
                entries.forEach(e => categorizedEntries.add(e));
            }
            const uncategorized = types.filter(t => !categorizedEntries.has(t));

            let html = '';

            // 未归类词条
            html += `<div class="entry-section">
                <div class="entry-section-header">
                    <span class="entry-section-title">未归类词条</span>
                    <span class="entry-section-count">${uncategorized.length}</span>
                </div>
                <div class="entry-list">`;

            uncategorized.forEach(type => {
                const safeType = escapeHtml(type);
                html += `<div class="entry-item">
                    <span class="entry-name">${safeType}</span>
                    <div class="entry-actions">
                        <button class="entry-action-btn entry-move-btn" title="归入类别" onclick="showMoveEntryMenu('${safeType}', this)">📋</button>
                        <button class="entry-action-btn entry-del-btn" title="删除" onclick="deleteEntry('${safeType}')">✕</button>
                    </div>
                </div>`;
            });

            html += `</div></div>`;

            // 已有类别
            for (const [catName, entries] of Object.entries(categories)) {
                const safeCat = escapeHtml(catName);
                html += `<div class="entry-section">
                    <div class="entry-section-header">
                        <span class="entry-section-title">${safeCat}</span>
                        <span class="entry-section-count">${entries.length}</span>
                        <button class="entry-action-btn entry-del-btn entry-cat-del" title="删除类别" onclick="deleteCategory('${safeCat}')">✕</button>
                    </div>
                    <div class="entry-list">`;

                entries.forEach(type => {
                    const safeType = escapeHtml(type);
                    html += `<div class="entry-item">
                        <span class="entry-name">${safeType}</span>
                        <div class="entry-actions">
                            <button class="entry-action-btn entry-move-btn" title="移至其他类别" onclick="showMoveEntryMenu('${safeType}', this)">📋</button>
                            <button class="entry-action-btn" title="移出类别" onclick="removeEntryFromCategory('${safeType}', '${safeCat}')">↩</button>
                            <button class="entry-action-btn entry-del-btn" title="删除" onclick="deleteEntry('${safeType}')">✕</button>
                        </div>
                    </div>`;
                });

                html += `</div></div>`;
            }

            // 添加新词条 & 新建类别
            html += `<div class="entry-add-row">
                <input type="text" id="newEntryInput" class="entry-add-input" placeholder="输入新词条" maxlength="20">
                <button class="entry-add-btn" onclick="addNewEntry()">添加词条</button>
            </div>
            <div class="entry-add-row">
                <input type="text" id="newCategoryInput" class="entry-add-input" placeholder="输入新类别名称" maxlength="20">
                <button class="entry-add-btn" onclick="addNewCategory()">新建类别</button>
            </div>`;

            body.innerHTML = html;
        }

        function addNewEntry() {
            const input = document.getElementById('newEntryInput');
            const name = input ? input.value.trim() : '';
            if (!name) return;
            addStudyType(name);
            renderEntryManager();
        }

        function addNewCategory() {
            const input = document.getElementById('newCategoryInput');
            const name = input ? input.value.trim() : '';
            if (!name) return;
            const categories = getStudyCategories();
            if (categories[name]) return; // 已存在
            categories[name] = [];
            saveStudyCategories(categories);
            renderEntryManager();
        }

        function deleteEntry(type) {
            const types = loadStudyTypes().filter(t => t !== type);
            saveStudyTypes(types);
            // 从类别中也移除
            const categories = getStudyCategories();
            for (const [cat, entries] of Object.entries(categories)) {
                categories[cat] = entries.filter(e => e !== type);
                if (categories[cat].length === 0) delete categories[cat];
            }
            saveStudyCategories(categories);
            renderStudyTypeButtons();
            renderEntryManager();
        }

        function deleteCategory(catName) {
            const categories = getStudyCategories();
            delete categories[catName];
            saveStudyCategories(categories);
            renderEntryManager();
        }

        function removeEntryFromCategory(entry, catName) {
            const categories = getStudyCategories();
            if (categories[catName]) {
                categories[catName] = categories[catName].filter(e => e !== entry);
                if (categories[catName].length === 0) delete categories[catName];
                saveStudyCategories(categories);
            }
            renderEntryManager();
        }

        function showMoveEntryMenu(entry, btnEl) {
            // 移除已有菜单
            const existing = document.querySelector('.entry-move-menu');
            if (existing) existing.remove();

            const categories = getStudyCategories();
            const menu = document.createElement('div');
            menu.className = 'entry-move-menu';

            // 新建类别选项
            let menuHtml = `<div class="entry-move-item" onclick="moveEntryToNewCategory('${escapeHtml(entry)}')">＋ 新建类别</div>`;

            for (const catName of Object.keys(categories)) {
                // 检查词条是否已在该类别中
                if (categories[catName].includes(entry)) continue;
                menuHtml += `<div class="entry-move-item" onclick="moveEntryToCategory('${escapeHtml(entry)}', '${escapeHtml(catName)}')">${escapeHtml(catName)}</div>`;
            }

            menu.innerHTML = menuHtml;
            btnEl.parentElement.appendChild(menu);

            // 点击其他地方关闭
            const closeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 0);
        }

        function moveEntryToCategory(entry, catName) {
            const categories = getStudyCategories();
            // 先从所有类别中移除
            for (const [cat, entries] of Object.entries(categories)) {
                categories[cat] = entries.filter(e => e !== entry);
                if (categories[cat].length === 0) delete categories[cat];
            }
            // 添加到目标类别
            if (!categories[catName]) categories[catName] = [];
            categories[catName].push(entry);
            saveStudyCategories(categories);
            renderEntryManager();
        }

        function moveEntryToNewCategory(entry) {
            const name = prompt('请输入新类别名称：');
            if (!name || !name.trim()) return;
            const categories = getStudyCategories();
            if (categories[name.trim()]) {
                // 已存在，直接移入
                moveEntryToCategory(entry, name.trim());
                return;
            }
            // 先从所有类别中移除
            for (const [cat, entries] of Object.entries(categories)) {
                categories[cat] = entries.filter(e => e !== entry);
                if (categories[cat].length === 0) delete categories[cat];
            }
            categories[name.trim()] = [entry];
            saveStudyCategories(categories);
            renderEntryManager();
        }

        // ==================== 面板帮助提示：鼠标离开500ms后消失 ====================
        (function initPanelHelpTooltips() {
            // 全局tooltip容器（放在body上，避免被父容器overflow/backdrop-filter截断）
            var globalTooltip = document.createElement('div');
            globalTooltip.className = 'panel-help-tooltip';
            globalTooltip.innerHTML = '';
            document.body.appendChild(globalTooltip);

            var currentWrapper = null;

            function showTooltip(wrapper) {
                var srcTooltip = wrapper.querySelector('.panel-help-tooltip');
                if (!srcTooltip) return;
                var iconEl = wrapper.querySelector('.panel-help-icon');
                var rect = iconEl ? iconEl.getBoundingClientRect() : wrapper.getBoundingClientRect();

                globalTooltip.textContent = srcTooltip.textContent;
                globalTooltip.classList.add('show');
                // 先显示以获取尺寸
                var tipW = globalTooltip.offsetWidth;
                var tipH = globalTooltip.offsetHeight;

                var left = rect.right - tipW;
                var top = rect.bottom + 8;
                if (left < 8) left = 8;
                if (top + tipH > window.innerHeight - 8) {
                    top = rect.top - tipH - 8;
                    globalTooltip.classList.add('above');
                } else {
                    globalTooltip.classList.remove('above');
                }
                globalTooltip.style.left = left + 'px';
                globalTooltip.style.top = top + 'px';
                currentWrapper = wrapper;
            }

            function hideTooltip(wrapper) {
                if (wrapper === currentWrapper || !wrapper) {
                    globalTooltip.classList.remove('show');
                    globalTooltip.classList.remove('above');
                    currentWrapper = null;
                }
            }

            document.addEventListener('mouseenter', function(e) {
                var wrapper = e.target.closest('.panel-help-wrapper');
                if (wrapper) {
                    showTooltip(wrapper);
                    if (wrapper._helpHideTimer) {
                        clearTimeout(wrapper._helpHideTimer);
                        wrapper._helpHideTimer = null;
                    }
                }
                if (e.target === globalTooltip && currentWrapper && currentWrapper._helpHideTimer) {
                    clearTimeout(currentWrapper._helpHideTimer);
                    currentWrapper._helpHideTimer = null;
                }
            }, true);

            document.addEventListener('mouseleave', function(e) {
                var wrapper = e.target.closest('.panel-help-wrapper');
                if (wrapper) {
                    if (wrapper._helpHideTimer) clearTimeout(wrapper._helpHideTimer);
                    wrapper._helpHideTimer = setTimeout(function() {
                        hideTooltip(wrapper);
                        wrapper._helpHideTimer = null;
                    }, 0);
                }
                if (e.target === globalTooltip && currentWrapper) {
                    if (currentWrapper._helpHideTimer) clearTimeout(currentWrapper._helpHideTimer);
                    currentWrapper._helpHideTimer = setTimeout(function() {
                        hideTooltip(currentWrapper);
                    }, 0);
                }
            }, true);
        })();

        // ==================== 更多图表 ====================
        let heatmapCurrentYear = new Date().getFullYear();
        let heatmapTooltipEl = null;
        let catLineFilterMode = 0; // 0=所有天, 1=近7天, 2=近30天
        let timelineDayOffset = 0;

        function openMoreCharts() {
            const chartsContainer = document.getElementById('chartsContainer');
            const lineChartContainer = document.getElementById('lineChartContainer');
            const recordsList = document.getElementById('recordsList');
            const totalTimeEl = document.getElementById('totalTime');
            const moreChartsPanel = document.getElementById('moreChartsPanel');
            const recordsContent = document.querySelector('#recordsModal .records-content');
            const modalHeader = document.querySelector('#recordsModal .modal-header');

            if (chartsContainer) chartsContainer.style.display = 'none';
            if (lineChartContainer) lineChartContainer.style.display = 'none';
            if (recordsList) recordsList.style.display = 'none';
            if (totalTimeEl) totalTimeEl.style.display = 'none';
            if (modalHeader) modalHeader.style.display = 'none';
            if (moreChartsPanel) moreChartsPanel.style.display = 'block';
            // 扩大面板
            if (recordsContent) recordsContent.classList.add('more-charts-expanded');

            // 顶部总时长
            loadRecords();
            const totalDuration = records.reduce((sum, r) => sum + r.duration, 0);
            const totalEl = document.getElementById('moreChartsTotalTime');
            if (totalEl) totalEl.innerHTML = '总自习时长: ' + formatTime(totalDuration);

            // 重置筛选
            catLineFilterMode = 0;
            const filterBtn = document.getElementById('catLineFilterBtn');
            if (filterBtn) filterBtn.textContent = '📊 所有天';

            // 重置时间轴偏移
            timelineDayOffset = 0;

            requestAnimationFrame(() => {
                drawCategoryLineChart(true);
                renderHeatmap();
                renderTimeline(0);
            });
        }

        function closeMoreCharts() {
            const chartsContainer = document.getElementById('chartsContainer');
            const lineChartContainer = document.getElementById('lineChartContainer');
            const recordsList = document.getElementById('recordsList');
            const totalTimeEl = document.getElementById('totalTime');
            const moreChartsPanel = document.getElementById('moreChartsPanel');
            const recordsContent = document.querySelector('#recordsModal .records-content');
            const modalHeader = document.querySelector('#recordsModal .modal-header');

            if (moreChartsPanel) moreChartsPanel.style.display = 'none';
            if (chartsContainer) chartsContainer.style.display = 'flex';
            if (recordsList) recordsList.style.display = 'block';
            if (totalTimeEl) totalTimeEl.style.display = 'block';
            if (modalHeader) modalHeader.style.display = '';
            if (recordsContent) {
                recordsContent.classList.remove('more-charts-expanded');
                recordsContent.scrollTop = 0;
            }
            if (heatmapTooltipEl) heatmapTooltipEl.style.display = 'none';
        }

        // ========== 折线图筛选切换 ==========
        function toggleCatLineFilter() {
            catLineFilterMode = (catLineFilterMode + 1) % 3;
            const btn = document.getElementById('catLineFilterBtn');
            const labels = ['📊 所有天', '📊 近7天', '📊 近30天'];
            if (btn) btn.textContent = labels[catLineFilterMode];
            drawCategoryLineChart(true);
        }

        // ========== 1. 各类别时长变化折线图（纯折线，带动画） ==========
        let catLineAnimId = null;
        let catLineAnimProgress = 0;
        let catLineConfig = null;

        function drawCategoryLineChart(animate = false) {
            const canvas = document.getElementById('categoryLineChart');
            const wrapper = document.getElementById('categoryLineChartWrapper');
            if (!canvas || !wrapper) return;

            loadRecords();
            if (records.length === 0) {
                const ctx = canvas.getContext('2d');
                const dpr = window.devicePixelRatio || 1;
                canvas.width = 400 * dpr;
                canvas.height = 200 * dpr;
                canvas.style.width = '400px';
                canvas.style.height = '200px';
                ctx.scale(dpr, dpr);
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.font = '14px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('暂无记录', 200, 100);
                document.getElementById('categoryLineLegend').innerHTML = '';
                return;
            }

            // 按日期和类别聚合
            const dateCatMap = {};
            const allCategories = new Set();
            records.forEach(r => {
                const dateStr = r.date;
                const category = getEntryCategory(r.studyType || '未分类');
                allCategories.add(category);
                if (!dateCatMap[dateStr]) dateCatMap[dateStr] = {};
                if (!dateCatMap[dateStr][category]) dateCatMap[dateStr][category] = 0;
                dateCatMap[dateStr][category] += Math.floor(r.duration / 60);
            });

            const sortedDates = Object.keys(dateCatMap).sort((a, b) => {
                return new Date(a.replace(/\//g, '-')) - new Date(b.replace(/\//g, '-'));
            });

            if (sortedDates.length === 0) return;

            let filteredDates;
            if (catLineFilterMode === 1) {
                filteredDates = sortedDates.slice(-7);
            } else if (catLineFilterMode === 2) {
                filteredDates = sortedDates.slice(-30);
            } else {
                filteredDates = sortedDates;
            }

            const firstDate = new Date(filteredDates[0].replace(/\//g, '-'));
            const lastDate = new Date(filteredDates[filteredDates.length - 1].replace(/\//g, '-'));
            const allDates = [];
            const currentDate = new Date(firstDate);
            while (currentDate <= lastDate) {
                allDates.push(currentDate.toLocaleDateString('zh-CN'));
                currentDate.setDate(currentDate.getDate() + 1);
            }

            const categories = [...allCategories];
            const catColors = {};
            categories.forEach(c => { catColors[c] = getStudyTypeColor(c); });

            const catData = {};
            categories.forEach(cat => {
                catData[cat] = allDates.map(dateStr => {
                    return (dateCatMap[dateStr] && dateCatMap[dateStr][cat]) || 0;
                });
            });

            let maxVal = 0;
            allDates.forEach((dateStr, i) => {
                categories.forEach(cat => {
                    if (catData[cat][i] > maxVal) maxVal = catData[cat][i];
                });
            });
            const niceMax = Math.ceil(maxVal / 60) * 60 || 60;

            const dpr = window.devicePixelRatio || 1;
            const padding = { top: 25, right: 20, bottom: 40, left: 60 };
            const chartWidth = wrapper.offsetWidth;
            const chartHeight = 260;
            const graphWidth = chartWidth - padding.left - padding.right;
            const graphHeight = chartHeight - padding.top - padding.bottom;
            const stepX = allDates.length > 1 ? graphWidth / (allDates.length - 1) : 0;

            canvas.width = chartWidth * dpr;
            canvas.height = chartHeight * dpr;
            canvas.style.width = chartWidth + 'px';
            canvas.style.height = chartHeight + 'px';

            // 保存配置用于动画
            catLineConfig = { ctx: canvas.getContext('2d'), canvas, chartWidth, chartHeight, padding, graphWidth, graphHeight, niceMax, allDates, categories, catColors, catData, stepX, dpr };

            // 图例
            const legendEl = document.getElementById('categoryLineLegend');
            legendEl.innerHTML = categories.map(cat =>
                `<div class="cat-line-legend-item"><div class="cat-line-legend-color" style="background:${catColors[cat]}"></div><span>${cat}</span></div>`
            ).join('');

            if (animate) {
                startCatLineAnimation();
            } else {
                catLineAnimProgress = 1;
                renderCatLineFrame();
            }

            // tooltip
            let tooltip = document.getElementById('catLineChartTooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'catLineChartTooltip';
                tooltip.style.cssText = `
                    position:fixed;background:rgba(20,25,40,0.92);
                    border:1px solid rgba(99,179,237,0.45);border-radius:10px;
                    padding:8px 14px;color:#fff;font-size:12px;
                    pointer-events:none;z-index:99999;display:none;
                    white-space:nowrap;backdrop-filter:blur(10px);
                    box-shadow:0 4px 20px rgba(0,0,0,0.4);
                `;
                document.body.appendChild(tooltip);
            }

            canvas.onmousemove = (e) => {
                if (catLineAnimProgress < 0.98) return;
                const rect = canvas.getBoundingClientRect();
                const sx = chartWidth / rect.width;
                const mx = (e.clientX - rect.left) * sx;
                const idx = Math.round((mx - padding.left) / stepX);
                if (idx < 0 || idx >= allDates.length) { tooltip.style.display = 'none'; return; }

                const dateStr = allDates[idx];
                let html = `<div style="font-weight:600;margin-bottom:4px">${dateStr}</div>`;
                let hasData = false;
                categories.forEach(cat => {
                    const val = catData[cat][idx];
                    if (val > 0) {
                        hasData = true;
                        html += `<div style="display:flex;align-items:center;gap:6px;margin-top:2px"><div style="width:8px;height:8px;border-radius:50%;background:${catColors[cat]}"></div>${cat}: ${formatHM(val)}</div>`;
                    }
                });
                if (!hasData) { tooltip.style.display = 'none'; return; }

                tooltip.innerHTML = html;
                tooltip.style.display = 'block';
                const tipW = tooltip.offsetWidth;
                const tipH = tooltip.offsetHeight;
                let tx = e.clientX + 12;
                let ty = e.clientY - tipH / 2;
                if (tx + tipW > window.innerWidth - 8) tx = e.clientX - tipW - 12;
                if (ty < 8) ty = 8;
                if (ty + tipH > window.innerHeight - 8) ty = window.innerHeight - tipH - 8;
                tooltip.style.left = tx + 'px';
                tooltip.style.top = ty + 'px';
            };
            canvas.onmouseleave = () => { tooltip.style.display = 'none'; };
        }

        function startCatLineAnimation() {
            if (catLineAnimId) cancelAnimationFrame(catLineAnimId);
            catLineAnimProgress = 0;
            const start = performance.now();
            const duration = 1500;
            function step(now) {
                const elapsed = now - start;
                catLineAnimProgress = Math.min(1, elapsed / duration);
                catLineAnimProgress = easeOutCubic(catLineAnimProgress);
                renderCatLineFrame();
                if (elapsed < duration) {
                    catLineAnimId = requestAnimationFrame(step);
                } else {
                    catLineAnimProgress = 1;
                    renderCatLineFrame();
                }
            }
            catLineAnimId = requestAnimationFrame(step);
        }

        function renderCatLineFrame() {
            if (!catLineConfig) return;
            const { ctx, canvas, chartWidth, chartHeight, padding, graphWidth, graphHeight, niceMax, allDates, categories, catColors, catData, stepX, dpr } = catLineConfig;
            const progress = catLineAnimProgress;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, chartWidth, chartHeight);

            // 网格
            ctx.globalAlpha = progress;
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 1;
            const ySteps = 5;
            for (let i = 0; i <= ySteps; i++) {
                const y = padding.top + (graphHeight / ySteps) * i;
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(padding.left + graphWidth, y);
                ctx.stroke();
                const val = Math.round(niceMax - (niceMax / ySteps) * i);
                ctx.fillStyle = 'rgba(255,255,255,0.45)';
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText(formatHMShort(val), padding.left - 8, y);
            }
            ctx.globalAlpha = 1;

            // 从左到右裁剪（留出数据点半径空间）
            ctx.save();
            ctx.beginPath();
            ctx.rect(padding.left - 4, 0, graphWidth * progress + 8, chartHeight);
            ctx.clip();

            // x轴标签
            const xLabelStep = Math.max(1, Math.floor(allDates.length / 8));
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            allDates.forEach((dateStr, i) => {
                if (i % xLabelStep === 0 || i === allDates.length - 1) {
                    const label = dateStr.split('/').slice(1).join('/');
                    const x = padding.left + i * stepX;
                    ctx.fillText(label, x, padding.top + graphHeight + 8);
                }
            });

            // 绘制纯折线
            categories.forEach(cat => {
                const data = catData[cat];
                const color = catColors[cat];

                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.lineJoin = 'round';
                data.forEach((val, i) => {
                    const x = padding.left + i * stepX;
                    const y = padding.top + graphHeight - (val / niceMax) * graphHeight;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.stroke();

                // 数据点
                data.forEach((val, i) => {
                    if (val > 0) {
                        const x = padding.left + i * stepX;
                        const y = padding.top + graphHeight - (val / niceMax) * graphHeight;
                        if (x <= padding.left + graphWidth * progress) {
                            ctx.beginPath();
                            ctx.arc(x, y, 3, 0, Math.PI * 2);
                            ctx.fillStyle = color;
                            ctx.fill();
                        }
                    }
                });
            });

            ctx.restore();
        }

        function formatHM(totalMinutes) {
            if (!totalMinutes || totalMinutes === 0) return '0分钟';
            const h = Math.floor(totalMinutes / 60);
            const m = totalMinutes % 60;
            if (h > 0 && m > 0) return `${h}小时${m}分钟`;
            if (h > 0) return `${h}小时`;
            return `${m}分钟`;
        }

        function formatHMShort(totalMinutes) {
            if (!totalMinutes || totalMinutes === 0) return '0分';
            const h = Math.floor(totalMinutes / 60);
            const m = totalMinutes % 60;
            if (h > 0 && m > 0) return `${h}h${m}m`;
            if (h > 0) return `${h}h`;
            return `${m}m`;
        }

        // ========== 2. 年度热力图 ==========
        function renderHeatmap() {
            const container = document.getElementById('heatmapContainer');
            const monthLabelsEl = document.getElementById('heatmapMonthLabels');
            const yearTitle = document.getElementById('heatmapYearTitle');
            if (!container) return;

            loadRecords();
            const year = heatmapCurrentYear;
            if (yearTitle) yearTitle.textContent = year + '年';

            const prevBtn = document.getElementById('heatmapPrevYear');
            const nextBtn = document.getElementById('heatmapNextYear');
            if (prevBtn) prevBtn.disabled = year <= 2025;
            if (nextBtn) nextBtn.disabled = year >= 2027;

            const dayMinutes = {};
            records.forEach(r => {
                const rDate = parseRecordDate(r.date);
                if (rDate.getFullYear() === year) {
                    if (!dayMinutes[r.date]) dayMinutes[r.date] = 0;
                    dayMinutes[r.date] += Math.floor(r.duration / 60);
                }
            });

            const maxMinutes = Math.max(...Object.values(dayMinutes), 1);

            const firstDay = new Date(year, 0, 1);
            const startWeekday = firstDay.getDay();
            const startOffset = startWeekday === 0 ? 6 : startWeekday - 1;

            const totalDays = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
            const weeks = Math.ceil((totalDays + startOffset) / 7);

            // 动态计算单元格大小以填满容器
            const containerWidth = container.offsetWidth;
            const weekdayLabelWidth = 22;
            const gap = 2;
            const availWidth = containerWidth - weekdayLabelWidth - gap;
            const cellSize = Math.max(8, Math.floor((availWidth - (weeks - 1) * gap) / weeks));
            const cellHeight = Math.max(8, Math.min(cellSize, 14));
            const weekdayLabelHeight = cellHeight + gap;

            let html = '<div class="heatmap-grid">';
            html += '<div class="heatmap-weekday-labels" style="gap:' + gap + 'px">';
            ['一', '', '三', '', '五', '', '日'].forEach(l => {
                html += `<div class="heatmap-weekday-label" style="width:${weekdayLabelWidth}px;height:${cellHeight}px;font-size:${Math.max(8, cellHeight - 2)}px">${l}</div>`;
            });
            html += '</div>';
            html += `<div class="heatmap-cells" style="gap:${gap}px">`;

            for (let w = 0; w < weeks; w++) {
                html += `<div class="heatmap-week" style="gap:${gap}px">`;
                for (let d = 0; d < 7; d++) {
                    const dayIndex = w * 7 + d - startOffset;
                    if (dayIndex < 0 || dayIndex >= totalDays) {
                        html += '<div class="heatmap-cell empty" style="width:' + cellSize + 'px;height:' + cellHeight + 'px"></div>';
                    } else {
                        const date = new Date(year, 0, dayIndex + 1);
                        const dateStr = date.toLocaleDateString('zh-CN');
                        const mins = dayMinutes[dateStr] || 0;
                        const intensity = mins / maxMinutes;
                        let bgColor;
                        if (mins === 0) {
                            bgColor = 'rgba(116,185,255,0.08)';
                        } else {
                            const alpha = 0.15 + intensity * 0.85;
                            bgColor = `rgba(116,185,255,${alpha.toFixed(2)})`;
                        }
                        const month = date.getMonth() + 1;
                        const day = date.getDate();
                        html += `<div class="heatmap-cell" style="background:${bgColor};width:${cellSize}px;height:${cellHeight}px" data-date="${dateStr}" data-mins="${mins}" data-label="${month}月${day}日" onmouseenter="showHeatmapTooltip(this)" onmouseleave="hideHeatmapTooltip()"></div>`;
                    }
                }
                html += '</div>';
            }
            html += '</div></div>';
            container.innerHTML = html;

            // 波动动画：从左到右逐列淡入
            const weekEls = container.querySelectorAll('.heatmap-week');
            weekEls.forEach((weekEl, wIdx) => {
                const delay = wIdx * 8;
                weekEl.querySelectorAll('.heatmap-cell').forEach(cell => {
                    cell.classList.add('wave-in');
                    cell.style.animationDelay = delay + 'ms';
                });
            });

            // 月份标签（用与grid完全相同的flex结构保证对齐）
            if (monthLabelsEl) {
                const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
                // 计算每个月对应的weekIndex
                const monthWeekIndices = monthNames.map((name, i) => {
                    const monthStart = new Date(year, i, 1);
                    const dayOfYear = Math.floor((monthStart - new Date(year, 0, 1)) / 86400000);
                    return Math.floor((dayOfYear + startOffset) / 7);
                });

                // 用与grid相同的flex布局：左侧spacer + 右侧与cells对齐的label容器
                let mhtml = `<div style="display:flex;gap:${gap}px">`;
                // 左侧spacer，与weekday-labels同宽
                mhtml += `<div style="width:${weekdayLabelWidth}px;flex-shrink:0"></div>`;
                // 右侧label容器，与heatmap-cells使用相同的flex布局
                mhtml += `<div style="display:flex;gap:${gap}px;position:relative;height:18px">`;
                // 每个月份标签定位到对应的week列
                monthNames.forEach((name, i) => {
                    const weekIdx = monthWeekIndices[i];
                    const leftPx = weekIdx * (cellSize + gap);
                    mhtml += `<span class="heatmap-month-label" style="position:absolute;left:${leftPx}px">${name}</span>`;
                });
                mhtml += '</div></div>';
                monthLabelsEl.innerHTML = mhtml;
                monthLabelsEl.style.paddingLeft = '';
                monthLabelsEl.style.boxSizing = '';
            }

            if (!heatmapTooltipEl) {
                heatmapTooltipEl = document.createElement('div');
                heatmapTooltipEl.className = 'heatmap-tooltip';
                heatmapTooltipEl.style.cssText = `
                    position:fixed;background:rgba(20,25,40,0.95);
                    border:1px solid rgba(116,185,255,0.4);border-radius:8px;
                    padding:6px 12px;color:#fff;font-size:12px;
                    pointer-events:none;z-index:99999;display:none;
                    white-space:nowrap;backdrop-filter:blur(10px);
                    box-shadow:0 4px 16px rgba(0,0,0,0.4);
                `;
                document.body.appendChild(heatmapTooltipEl);
            }
        }

        function showHeatmapTooltip(cell) {
            if (!heatmapTooltipEl) return;
            const mins = parseInt(cell.dataset.mins);
            const label = cell.dataset.label;
            heatmapTooltipEl.innerHTML = `<div style="font-weight:600">${label}</div><div style="color:#90cdf4;margin-top:2px">${mins > 0 ? formatHM(mins) : '轻轻路过'}</div>`;
            const rect = cell.getBoundingClientRect();
            heatmapTooltipEl.style.left = (rect.left + rect.width / 2) + 'px';
            heatmapTooltipEl.style.top = (rect.top - 8) + 'px';
            heatmapTooltipEl.style.transform = 'translate(-50%, -100%)';
            heatmapTooltipEl.style.display = 'block';
        }

        function hideHeatmapTooltip() {
            if (heatmapTooltipEl) heatmapTooltipEl.style.display = 'none';
        }

        function heatmapPrevYearFn() {
            if (heatmapCurrentYear > 2025) { heatmapCurrentYear--; renderHeatmap(); }
        }

        function heatmapNextYearFn() {
            if (heatmapCurrentYear < 2027) { heatmapCurrentYear++; renderHeatmap(); }
        }

        // ========== 3. 每日时间轴 ==========
        function renderTimeline(dayOffset) {
            const barContainer = document.getElementById('timelineBarContainer');
            const analysisEl = document.getElementById('timelineAnalysis');
            const overallEl = document.getElementById('timelineOverallStats');
            const legendEl = document.getElementById('timelineLegend');
            const dayLabelEl = document.getElementById('timelineDayLabel');
            const nextDayBtn = document.getElementById('timelineNextDay');
            if (!barContainer) return;

            loadRecords();
            timelineDayOffset = dayOffset;
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - dayOffset);
            const dateStr = targetDate.toLocaleDateString('zh-CN');

            // 更新日期标签
            if (dayLabelEl) {
                if (dayOffset === 0) dayLabelEl.textContent = '今天';
                else if (dayOffset === 1) dayLabelEl.textContent = '昨天';
                else if (dayOffset === 2) dayLabelEl.textContent = '前天';
                else dayLabelEl.textContent = `${targetDate.getMonth() + 1}月${targetDate.getDate()}日`;
            }
            // 不能超过今天
            if (nextDayBtn) nextDayBtn.disabled = dayOffset <= 0;

            const dayRecords = records.filter(r => r.date === dateStr);

            if (dayRecords.length === 0) {
                barContainer.innerHTML = `<div class="timeline-empty">暂无自习记录</div>`;
                if (analysisEl) analysisEl.innerHTML = '';
                if (legendEl) legendEl.innerHTML = '';
                if (overallEl) overallEl.innerHTML = '';
                return;
            }

            // 渲染时间块（不在块上显示文字）
            const usedCategories = new Set();
            let html = '';
            let blockIdx = 0;
            dayRecords.forEach(r => {
                const category = getEntryCategory(r.studyType || '未分类');
                usedCategories.add(category);
                const color = getStudyTypeColor(category);
                const startParts = r.startTime.split(':');
                const startHour = parseInt(startParts[0]);
                const startMin = parseInt(startParts[1]);
                const startSeconds = startHour * 3600 + startMin * 60;
                const endParts = r.endTime.split(':');
                const endHour = parseInt(endParts[0]);
                const endMin = parseInt(endParts[1]);
                const endSeconds = endHour * 3600 + endMin * 60;
                const leftPercent = (startSeconds / 86400) * 100;
                const widthPercent = Math.max(((endSeconds - startSeconds) / 86400) * 100, 0.3);
                // 悬停精确到分钟
                const startStr = String(startHour).padStart(2,'0') + ':' + String(startMin).padStart(2,'0');
                const endStr = String(endHour).padStart(2,'0') + ':' + String(endMin).padStart(2,'0');
                const durationStr = formatTime(r.duration, false);
                const delay = blockIdx * 80;
                html += `<div class="timeline-block" style="left:${leftPercent}%;width:${widthPercent}%;background:${color};animation-delay:${delay}ms" title="${category}: ${startStr}-${endStr} (${durationStr})"></div>`;
                blockIdx++;
            });
            barContainer.innerHTML = html;

            // 图例（显示当天用到的类别）
            if (legendEl) {
                legendEl.innerHTML = [...usedCategories].map(cat =>
                    `<div class="timeline-legend-item"><div class="timeline-legend-color" style="background:${getStudyTypeColor(cat)}"></div><span>${cat}</span></div>`
                ).join('');
            }

            // 当天分析
            if (analysisEl) {
                let earliestSec = 86400, latestSec = 0;
                dayRecords.forEach(r => {
                    const sp = r.startTime.split(':');
                    const s = parseInt(sp[0]) * 3600 + parseInt(sp[1]) * 60;
                    const ep = r.endTime.split(':');
                    const e = parseInt(ep[0]) * 3600 + parseInt(ep[1]) * 60;
                    if (s < earliestSec) earliestSec = s;
                    if (e > latestSec) latestSec = e;
                });
                const pad = n => String(n).padStart(2, '0');
                const earliestH = Math.floor(earliestSec / 3600);
                const earliestM = Math.floor((earliestSec % 3600) / 60);
                const latestH = Math.floor(latestSec / 3600);
                const latestM = Math.floor((latestSec % 3600) / 60);

                const hourBuckets = new Array(24).fill(0);
                dayRecords.forEach(r => {
                    const sp = r.startTime.split(':');
                    const s = parseInt(sp[0]) * 3600 + parseInt(sp[1]) * 60;
                    const ep = r.endTime.split(':');
                    const e = parseInt(ep[0]) * 3600 + parseInt(ep[1]) * 60;
                    for (let t = s; t < e; t += 60) {
                        const h = Math.floor(t / 3600);
                        if (h >= 0 && h < 24) hourBuckets[h]++;
                    }
                });
                const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));

                analysisEl.innerHTML = `
                    <div class="timeline-stat-item"><span class="timeline-stat-label">活跃时间跨度</span><span class="timeline-stat-value">${pad(earliestH)}:${pad(earliestM)} ~ ${pad(latestH)}:${pad(latestM)}</span></div>
                    <div class="timeline-stat-item"><span class="timeline-stat-label">高峰时段</span><span class="timeline-stat-value">${peakHour}:00 - ${peakHour + 1}:00</span></div>
                `;
            }

            // 总体统计
            if (overallEl) {
                const allHourBuckets = new Array(24).fill(0);
                let allEarliest = 86400, allLatest = 0;
                records.forEach(r => {
                    const sp = r.startTime.split(':');
                    const s = parseInt(sp[0]) * 3600 + parseInt(sp[1]) * 60;
                    const ep = r.endTime.split(':');
                    const e = parseInt(ep[0]) * 3600 + parseInt(ep[1]) * 60;
                    if (s < allEarliest) allEarliest = s;
                    if (e > allLatest) allLatest = e;
                    for (let t = s; t < e; t += 60) {
                        const h = Math.floor(t / 3600);
                        if (h >= 0 && h < 24) allHourBuckets[h]++;
                    }
                });
                const allPeakHour = allHourBuckets.indexOf(Math.max(...allHourBuckets));
                const pad = n => String(n).padStart(2, '0');
                const aeH = Math.floor(allEarliest / 3600);
                const aeM = Math.floor((allEarliest % 3600) / 60);
                const alH = Math.floor(allLatest / 3600);
                const alM = Math.floor((allLatest % 3600) / 60);

                overallEl.innerHTML = `
                    <div class="timeline-stat-section-title">📊 总体统计</div>
                    <div class="timeline-stat-item"><span class="timeline-stat-label">总体活跃时间跨度</span><span class="timeline-stat-value">${pad(aeH)}:${pad(aeM)} ~ ${pad(alH)}:${pad(alM)}</span></div>
                    <div class="timeline-stat-item"><span class="timeline-stat-label">总体高峰时段</span><span class="timeline-stat-value">${allPeakHour}:00 - ${allPeakHour + 1}:00</span></div>
                `;
            }
        }

        function timelinePrevDayFn() {
            timelineDayOffset++;
            renderTimeline(timelineDayOffset);
        }

        function timelineNextDayFn() {
            if (timelineDayOffset > 0) {
                timelineDayOffset--;
                renderTimeline(timelineDayOffset);
            }
        }

        async function refreshWallpaperSlots() {
            const cfg = getWallpaperConfig();
            const wallpapers = await wpGetAllMeta();
            const sameToggle = document.getElementById('wallpaperSameToggle');
            const slotOff = document.getElementById('wallpaperSlotOff');
            const sameCol = document.querySelector('.wallpaper-slot-same-col');
            const onThumb = document.getElementById('wallpaperSlotOnThumb');
            const offThumb = document.getElementById('wallpaperSlotOffThumb');

            if (sameToggle) sameToggle.checked = cfg.same;
            if (slotOff) slotOff.classList.toggle('wallpaper-slot-off-hidden', cfg.same);
            if (sameCol) sameCol.classList.toggle('wallpaper-slot-off-hidden', cfg.same);

            if (onThumb) {
                const onWp = wallpapers.find(w => w.id === cfg.on);
                if (onWp && onWp.thumb) {
                    onThumb.style.backgroundImage = `url('${onWp.thumb}')`;
                    onThumb.classList.add('custom');
                } else {
                    onThumb.style.backgroundImage = DEFAULT_ON_IMG;
                    onThumb.classList.remove('custom');
                }
            }
            if (offThumb) {
                const offWp = wallpapers.find(w => w.id === cfg.off);
                if (offWp && offWp.thumb) {
                    offThumb.style.backgroundImage = `url('${offWp.thumb}')`;
                    offThumb.classList.add('custom');
                } else {
                    offThumb.style.backgroundImage = DEFAULT_OFF_IMG;
                    offThumb.classList.remove('custom');
                }
            }

            document.querySelectorAll('.wallpaper-card').forEach(card => {
                const id = card.dataset.id;
                const isOnActive = (cfg.on === 'default' && id === 'default') || (cfg.on === id);
                const isOffActive = (cfg.off === 'default' && id === 'default-off') || (cfg.off === id);
                card.classList.toggle('active', isOnActive || isOffActive);
            });
        }

        function chooseWallpaperForSlot(slot) {
            wallpaperChoosingSlot = slot;
            const onSlot = document.getElementById('wallpaperSlotOn');
            const offSlot = document.getElementById('wallpaperSlotOff');
            if (onSlot) onSlot.style.outline = slot === 'on' ? '2px solid rgba(100,160,255,0.6)' : 'none';
            if (offSlot) offSlot.style.outline = slot === 'off' ? '2px solid rgba(100,160,255,0.6)' : 'none';
        }

        function toggleSameWallpaper() {
            const sameToggle = document.getElementById('wallpaperSameToggle');
            const cfg = getWallpaperConfig();
            cfg.same = sameToggle.checked;
            if (cfg.same) cfg.off = cfg.on;
            saveWallpaperConfig(cfg);
            refreshWallpaperSlots();
            applyCurrentWallpaper();
        }

        async function switchWallpaperTab(tab) {
            wallpaperCurrentTab = tab;
            const staticTab = document.getElementById('wpTabStatic');
            const dynamicTab = document.getElementById('wpTabDynamic');
            if (staticTab) staticTab.classList.toggle('active', tab === 'static');
            if (dynamicTab) dynamicTab.classList.toggle('active', tab === 'dynamic');
            await renderWallpaperGallery();
        }

        async function renderWallpaperGallery() {
            const gallery = document.getElementById('wallpaperGallery');
            const empty = document.getElementById('wallpaperEmpty');
            const wallpapers = await wpGetAllMeta();
            if (!gallery) return;
            gallery.innerHTML = '';
            const cfg = getWallpaperConfig();
            const isStaticTab = wallpaperCurrentTab === 'static';

            if (isStaticTab) {
                // 默认壁纸：浅色
                const defaultOnCard = document.createElement('div');
                defaultOnCard.className = 'wallpaper-card' + (cfg.on === 'default' ? ' active' : '');
                defaultOnCard.dataset.id = 'default';
                defaultOnCard.innerHTML = `
                    <div class="wallpaper-thumb" style="background-image: ${DEFAULT_ON_IMG};"></div>
                    <div class="wallpaper-card-name">浅色默认</div>
                    <div class="wallpaper-card-actions">
                        <button class="wallpaper-card-action wallpaper-apply-btn" title="设为浅色壁纸" onclick="event.stopPropagation(); applyWallpaperToSlot('on', 'default')">💡</button>
                        <button class="wallpaper-card-action wallpaper-apply-btn" title="设为深色壁纸" onclick="event.stopPropagation(); applyWallpaperToSlot('off', 'default')">🌙</button>
                    </div>
                `;
                defaultOnCard.addEventListener('click', () => applyWallpaperToSlot(wallpaperChoosingSlot || 'on', 'default'));
                gallery.appendChild(defaultOnCard);

                // 默认壁纸：深色
                const defaultOffCard = document.createElement('div');
                defaultOffCard.className = 'wallpaper-card' + (cfg.off === 'default' ? ' active' : '');
                defaultOffCard.dataset.id = 'default-off';
                defaultOffCard.innerHTML = `
                    <div class="wallpaper-thumb" style="background-image: ${DEFAULT_OFF_IMG};"></div>
                    <div class="wallpaper-card-name">深色默认</div>
                    <div class="wallpaper-card-actions">
                        <button class="wallpaper-card-action wallpaper-apply-btn" title="设为浅色壁纸" onclick="event.stopPropagation(); applyWallpaperToSlot('on', 'default')">💡</button>
                        <button class="wallpaper-card-action wallpaper-apply-btn" title="设为深色壁纸" onclick="event.stopPropagation(); applyWallpaperToSlot('off', 'default')">🌙</button>
                    </div>
                `;
                defaultOffCard.addEventListener('click', () => applyWallpaperToSlot(wallpaperChoosingSlot || 'off', 'default'));
                gallery.appendChild(defaultOffCard);

                const staticWps = wallpapers.filter(wp => wp.type !== 'dynamic' && wp.type !== 'video');
                staticWps.forEach(wp => gallery.appendChild(createWallpaperCard(wp, cfg)));
                if (empty) empty.style.display = staticWps.length > 0 ? 'none' : 'block';
            } else {
                const dynamicWps = wallpapers.filter(wp => wp.type === 'dynamic' || wp.type === 'video');
                if (dynamicWps.length === 0) {
                    if (empty) { empty.textContent = '暂无动态壁纸，点击上方按钮导入 GIF 或视频'; empty.style.display = 'block'; }
                } else {
                    if (empty) empty.style.display = 'none';
                    dynamicWps.forEach(wp => gallery.appendChild(createWallpaperCard(wp, cfg)));
                }
            }
        }

        function createWallpaperCard(wp, cfg) {
            const card = document.createElement('div');
            const isActive = (cfg.on === wp.id || cfg.off === wp.id);
            card.className = 'wallpaper-card' + (isActive ? ' active' : '');
            card.dataset.id = wp.id;
            const isDynamic = wp.type === 'dynamic' || wp.type === 'video';
            const badge = isDynamic ? `<div class="wallpaper-dynamic-badge">${wp.type === 'video' ? '▶ 视频' : 'GIF'}</div>` : '';
            const thumbBg = wp.thumb ? `url('${wp.thumb}')` : 'rgba(0,0,0,0.2)';
            card.innerHTML = `
                <div class="wallpaper-thumb" style="background-image: ${thumbBg};"></div>
                ${badge}
                <div class="wallpaper-card-name">${wp.name}</div>
                <div class="wallpaper-card-actions">
                    <button class="wallpaper-card-action wallpaper-apply-btn" title="设为浅色壁纸" onclick="event.stopPropagation(); applyWallpaperToSlot('on', '${wp.id}')">💡</button>
                    <button class="wallpaper-card-action wallpaper-apply-btn" title="设为深色壁纸" onclick="event.stopPropagation(); applyWallpaperToSlot('off', '${wp.id}')">🌙</button>
                    <button class="wallpaper-card-action" title="删除" onclick="event.stopPropagation(); deleteWallpaper('${wp.id}')">✕</button>
                </div>
            `;
            card.addEventListener('click', () => applyWallpaperToSlot(wallpaperChoosingSlot || 'on', wp.id));
            return card;
        }

        // ---- 导入 ----
        function importWallpaper() {
            const input = document.getElementById('wallpaperFileInput');
            input.value = '';
            input.accept = 'image/*,video/mp4,video/webm,video/ogg';
            input.onchange = handleWallpaperImport;
            input.click();
        }

        function getWallpaperType(filename) {
            const ext = filename.split('.').pop().toLowerCase();
            if (DYNAMIC_EXTS.includes(ext)) return 'dynamic';
            if (VIDEO_EXTS.includes(ext)) return 'video';
            return 'static';
        }

        async function handleWallpaperImport(event) {
            const files = event.target.files;
            if (!files || files.length === 0) return;
            let processed = 0;
            const total = files.length;

            async function onDone() {
                await renderWallpaperGallery();
                refreshWallpaperSlots();
            }

            Array.from(files).forEach(file => {
                const wpType = getWallpaperType(file.name);
                const id = 'wp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
                const name = file.name.replace(/\.[^.]+$/, '');
                const blob = file; // File 就是 Blob

                if (wpType === 'video') {
                    const url = URL.createObjectURL(blob);
                    const video = document.createElement('video');
                    video.muted = true;
                    video.preload = 'metadata';
                    video.onloadeddata = function() {
                        video.currentTime = Math.min(0.5, video.duration / 2);
                    };
                    video.onseeked = async function() {
                        const canvas = document.createElement('canvas');
                        const maxW = 320, maxH = 180;
                        let w = video.videoWidth, h = video.videoHeight;
                        if (w > maxW) { h = h * maxW / w; w = maxW; }
                        if (h > maxH) { w = w * maxH / h; h = maxH; }
                        canvas.width = Math.round(w);
                        canvas.height = Math.round(h);
                        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
                        const thumb = canvas.toDataURL('image/jpeg', 0.7);
                        URL.revokeObjectURL(url);
                        await wpAdd({ id, name, type: 'video', thumb, blob });
                        processed++;
                        if (processed === total) onDone();
                    };
                    video.onerror = async function() {
                        URL.revokeObjectURL(url);
                        await wpAdd({ id, name, type: 'video', thumb: '', blob });
                        processed++;
                        if (processed === total) onDone();
                    };
                    video.src = url;
                } else {
                    // 图片（静态或 GIF）
                    const url = URL.createObjectURL(blob);
                    const img = new Image();
                    img.onload = async function() {
                        const canvas = document.createElement('canvas');
                        const maxW = 320, maxH = 180;
                        let w = img.width, h = img.height;
                        if (w > maxW) { h = h * maxW / w; w = maxW; }
                        if (h > maxH) { w = w * maxH / h; h = maxH; }
                        canvas.width = Math.round(w);
                        canvas.height = Math.round(h);
                        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                        const thumb = canvas.toDataURL('image/jpeg', 0.7);
                        URL.revokeObjectURL(url);
                        await wpAdd({ id, name, type: wpType, thumb, blob });
                        processed++;
                        if (processed === total) onDone();
                    };
                    img.onerror = async function() {
                        URL.revokeObjectURL(url);
                        await wpAdd({ id, name, type: wpType, thumb: '', blob });
                        processed++;
                        if (processed === total) onDone();
                    };
                    img.src = url;
                }
            });
        }

        // ---- 应用/删除 ----
        async function applyWallpaperToSlot(slot, id) {
            const cfg = getWallpaperConfig();
            cfg[slot] = id;
            if (cfg.same) { cfg.on = id; cfg.off = id; }
            saveWallpaperConfig(cfg);
            wallpaperChoosingSlot = null;
            const onSlot = document.getElementById('wallpaperSlotOn');
            const offSlot = document.getElementById('wallpaperSlotOff');
            if (onSlot) onSlot.style.outline = 'none';
            if (offSlot) offSlot.style.outline = 'none';
            await refreshWallpaperSlots();
            applyCurrentWallpaper();
        }

        async function resetWallpaperSlot(slot) {
            const cfg = getWallpaperConfig();
            cfg[slot] = 'default';
            if (cfg.same) { cfg.on = 'default'; cfg.off = 'default'; }
            saveWallpaperConfig(cfg);
            await refreshWallpaperSlots();
            applyCurrentWallpaper();
        }

        async function deleteWallpaper(id) {
            await wpDelete(id);
            const cfg = getWallpaperConfig();
            let changed = false;
            if (cfg.on === id) { cfg.on = 'default'; changed = true; }
            if (cfg.off === id) { cfg.off = 'default'; changed = true; }
            if (changed) { saveWallpaperConfig(cfg); applyCurrentWallpaper(); }
            await renderWallpaperGallery();
            refreshWallpaperSlots();
        }

        async function applyCurrentWallpaper() {
            await applyLightModeAsync(getSettings().lightMode || 'on');
        }

        // 异步版本的 applyLightMode，支持从 IndexedDB 读取 Blob
        async function applyLightModeAsync(mode) {
            const lightOnImg = DEFAULT_ON_IMG;
            const lightOffImg = DEFAULT_OFF_IMG;
            const lightOnBtn = document.getElementById('lightOn');
            const lightOffBtn = document.getElementById('lightOff');
            if (lightOnBtn && lightOffBtn) {
                lightOnBtn.classList.toggle('active', mode === 'on');
                lightOffBtn.classList.toggle('active', mode === 'off');
            }

            const cfg = getWallpaperConfig();
            const parallaxBg = document.querySelector('.parallax-bg');
            const studyBg = document.getElementById('studyBg');
            const bgOverlay = document.getElementById('bgOverlay');
            const dynamicLayer = document.getElementById('dynamicWallpaperLayer');

            const slotKey = mode === 'on' ? 'on' : 'off';
            const activeId = cfg.same ? cfg.on : cfg[slotKey];

            let activeWp = null;
            if (activeId && activeId.startsWith('wp_')) {
                activeWp = await wpGetById(activeId);
            }

            const isDynamic = activeWp && (activeWp.type === 'dynamic' || activeWp.type === 'video');

            if (dynamicLayer) {
                if (!isDynamic) {
                    dynamicLayer.innerHTML = '';
                    dynamicLayer.style.display = 'none';
                    dynamicLayer.dataset.activeId = '';
                }
            }

            if (isDynamic && activeWp && activeWp.blob) {
                // 动态壁纸
                if (parallaxBg) parallaxBg.style.backgroundImage = 'none';
                if (studyBg) {
                    studyBg.style.backgroundImage = 'none';
                    if (mode === 'on') studyBg.classList.add('active');
                    else studyBg.classList.remove('active');
                }
                if (bgOverlay) {
                    bgOverlay.style.backgroundImage = 'none';
                    if (mode === 'off') bgOverlay.classList.add('active');
                    else bgOverlay.classList.remove('active');
                }

                if (dynamicLayer) {
                    dynamicLayer.style.display = 'block';
                    const existingId = dynamicLayer.dataset.activeId;
                    if (existingId !== activeWp.id) {
                        // 清理旧 ObjectURL
                        const oldEl = dynamicLayer.querySelector('img, video');
                        if (oldEl && oldEl.src.startsWith('blob:')) URL.revokeObjectURL(oldEl.src);
                        dynamicLayer.innerHTML = '';
                        dynamicLayer.dataset.activeId = activeWp.id;

                        const objUrl = URL.createObjectURL(activeWp.blob);
                        if (activeWp.type === 'video') {
                            const video = document.createElement('video');
                            video.src = objUrl;
                            video.autoplay = true;
                            video.loop = true;
                            video.muted = true;
                            video.playsInline = true;
                            video.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;';
                            dynamicLayer.appendChild(video);
                        } else {
                            const img = document.createElement('img');
                            img.src = objUrl;
                            img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;';
                            dynamicLayer.appendChild(img);
                        }
                    }
                }
            } else {
                // 静态壁纸
                let img;
                if (activeWp && activeWp.blob) {
                    const objUrl = URL.createObjectURL(activeWp.blob);
                    img = `url('${objUrl}')`;
                } else {
                    img = mode === 'on' ? lightOnImg : lightOffImg;
                }

                if (parallaxBg) parallaxBg.style.backgroundImage = img;
                if (studyBg) {
                    studyBg.style.backgroundImage = img;
                    if (mode === 'on') studyBg.classList.add('active');
                    else studyBg.classList.remove('active');
                }
                if (bgOverlay) {
                    if (mode === 'off') {
                        bgOverlay.style.backgroundImage = img;
                        bgOverlay.classList.add('active');
                    } else {
                        // 浅色模式时：先淡出再换背景，避免亮色壁纸从 bgOverlay 透出
                        bgOverlay.classList.remove('active');
                        // 延迟换背景，等淡出完成
                        setTimeout(() => { bgOverlay.style.backgroundImage = img; }, 800);
                    }
                }
            }
        }

        function updateEnvFxParamsRow() {
            const settings = getSettings();
            const row = document.getElementById('envFxParamsRow');
            if (row) {
                if (settings.envFxEnabled) {
                    row.classList.remove('setting-item-disabled');
                } else {
                    row.classList.add('setting-item-disabled');
                }
            }
        }

        function resetEnvFxDefaults() {
            // 所有特效参数的默认值
            const defaults = {
                thunderCloudEnabled: true, thunderCloudAmount: 191, thunderCloudFog: 100,
                thunderCloudOpacity: 119, thunderCloudThickness: 195, thunderCloudClustering: 175,
                thunderCloudSpeed: 100, thunderCloudBrightness: 77, thunderLightningFreq: 50,
                thunderCloudQuality: 35,
                rainCardEnabled: true, rainCardDensity: 98, rainCardDropSize: 134,
                rainCardRefraction: 100, rainCardBrightness: 100,
                rainFallEnabled: true, rainFallDensity: 232, rainFallSize: 135,
                splashIntensity: 100, rainFallSpeed: 100,
                acMistEnabled: true, acMistIntensity: 69, acMistSpeed: 169,
                acMistSpread: 88, acMistLength: 100, acMistAngle: 30,
                bonfireEnabled: true, bonfireSize: 100, bonfireLight: 100,
                bonfireFlicker: 100, bonfireHeight: 100,
                fireflyEnabled: true, fireflyDensity: 191, fireflySize: 32,
                fireflyGlow: 129, fireflySpeed: 100, fireflyBlinkFreq: 100
            };
            // 读取当前设置，用默认值覆盖特效参数，保留其他设置
            const saved = JSON.parse(localStorage.getItem('studySettings') || '{}');
            Object.assign(saved, defaults);
            localStorage.setItem('studySettings', JSON.stringify(saved));
            // 重新加载设置到 UI
            loadSettings();
            // 实时更新活跃特效
            updateThunderSettings();
            updateRainFallSettings();
            updateAcMistSettings();
            updateBonfireSettings();
            updateFireflySettings();
        }

        function loadVolumeOnStart() {
            const settings = getSettings();
            audioTargetVolume = settings.volume / 100;
            if (!audioFadingOut) {
                document.getElementById('bgMusic').volume = audioTargetVolume;
            }
        }

        async function requestWakeLock() {
            if (!isStudying) return;
            if ('wakeLock' in navigator) {
                try {
                    if (wakeLock) return;
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('Wake Lock 已激活');
                    // Wake Lock 成功时暂停音频后备
                    const wakeAudio = document.getElementById('wakeAudio');
                    if (wakeAudio) wakeAudio.pause();
                    wakeLock.addEventListener('release', () => {
                        console.log('Wake Lock 已释放');
                        wakeLock = null;
                        if (isStudying) {
                            requestWakeLock();
                        }
                    });
                } catch (err) {
                    console.log(`${err.name}, ${err.message}`);
                    startWakeAudioFallback();
                }
            } else {
                console.log('浏览器不支持 Wake Lock API');
                startWakeAudioFallback();
            }
        }

        function startWakeAudioFallback() {
            // 使用无声音频作为屏幕唤醒的后备方案
            const wakeAudio = document.getElementById('wakeAudio');
            if (wakeAudio) {
                // 如果已经有 src，只需尝试恢复播放和 AudioContext
                if (wakeAudio.src) {
                    wakeAudio.play().catch(() => {});
                    if (wakeAudioContext && wakeAudioContext.state === 'suspended') {
                        wakeAudioContext.resume().catch(() => {});
                    }
                    return;
                }
                // 创建一个 1 秒的静默音频
                wakeAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                const buffer = wakeAudioContext.createBuffer(1, wakeAudioContext.sampleRate, wakeAudioContext.sampleRate);
                const channelData = buffer.getChannelData(0);
                for (let i = 0; i < channelData.length; i++) {
                    channelData[i] = 0;
                }
                // 将 AudioBuffer 转换为 WAV 文件
                const wavBlob = audioBufferToWavBlob(buffer);
                const url = URL.createObjectURL(wavBlob);
                wakeAudio.src = url;
                wakeAudio.loop = true;
                wakeAudio.muted = true;
                wakeAudio.volume = 0;
                // 尝试恢复 AudioContext（处理浏览器自动挂起）
                if (wakeAudioContext.state === 'suspended') {
                    wakeAudioContext.resume().catch(() => {});
                }
                wakeAudio.play().catch(err => {
                    console.log('无法播放唤醒音频:', err);
                });
            }
        }

        function audioBufferToWavBlob(buffer) {
            const numChannels = buffer.numberOfChannels;
            const sampleRate = buffer.sampleRate;
            const format = 1; // PCM
            const bitDepth = 16;

            const bytesPerSample = bitDepth / 8;
            const blockAlign = numChannels * bytesPerSample;

            const dataLength = buffer.length * blockAlign;
            const bufferLength = 44 + dataLength;

            const arrayBuffer = new ArrayBuffer(bufferLength);
            const view = new DataView(arrayBuffer);

            // RIFF 标识符
            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + dataLength, true);
            writeString(view, 8, 'WAVE');

            // fmt 子块
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, format, true);
            view.setUint16(22, numChannels, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * blockAlign, true);
            view.setUint16(32, blockAlign, true);
            view.setUint16(34, bitDepth, true);

            // data 子块
            writeString(view, 36, 'data');
            view.setUint32(40, dataLength, true);

            // 写入数据
            let offset = 44;
            for (let i = 0; i < buffer.length; i++) {
                for (let channel = 0; channel < numChannels; channel++) {
                    const sample = buffer.getChannelData(channel)[i];
                    // 钳位到 [-1, 1]
                    const clamped = Math.max(-1, Math.min(1, sample));
                    // 缩放至 16 位
                    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
                    view.setInt16(offset, int16, true);
                    offset += bytesPerSample;
                }
            }

            return new Blob([arrayBuffer], { type: 'audio/wav' });
        }

        function writeString(view, offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }

        function stopWakeLock() {
            if (wakeLock) {
                wakeLock.release();
                wakeLock = null;
            }
            const wakeAudio = document.getElementById('wakeAudio');
            if (wakeAudio) {
                wakeAudio.pause();
                wakeAudio.currentTime = 0;
            }
            if (wakeLockInterval) {
                clearInterval(wakeLockInterval);
                wakeLockInterval = null;
            }
        }

        function startWakeLockTimer() {
            stopWakeLock();
            requestWakeLock();
            const settings = getSettings();
            // 用户设置决定激活间隔，但为避免超过常见系统息屏时间，最多 2 分钟检查一次
            const intervalMs = Math.min(settings.screenWakeTime * 60 * 1000, 2 * 60 * 1000);
            // 定期重新请求 Wake Lock 或保持音频播放
            wakeLockInterval = setInterval(() => {
                if (!isStudying) return;
                // 如果 Wake Lock 丢失，立即重新请求
                if (!wakeLock) {
                    requestWakeLock();
                }
                // 同时确保音频后备在播放
                const wakeAudio = document.getElementById('wakeAudio');
                if (wakeAudio && wakeAudio.paused) {
                    wakeAudio.play().catch(() => {});
                }
                // 尝试恢复可能被挂起的 AudioContext
                if (wakeAudioContext && wakeAudioContext.state === 'suspended') {
                    wakeAudioContext.resume().catch(() => {});
                }
            }, intervalMs);
        }

        function getSettings() {
            const defaultSettings = {
                autoFullscreen: false,
                restReminderTime: 50,
                screenWakeTime: 3,
                volume: 50,
                theme: 'rounded',
                lightMode: 'on',
                thunderCloudEnabled: true,
                envFxEnabled: true,
                thunderCloudAmount: 191,
                thunderCloudFog: 100,
                thunderCloudOpacity: 119,
                thunderCloudThickness: 195,
                thunderCloudClustering: 175,
                thunderCloudSpeed: 100,
                thunderCloudBrightness: 77,
                thunderLightningFreq: 50,
                thunderCloudQuality: 35,
                rainCardEnabled: true,
                rainCardDensity: 98,
                rainCardDropSize: 134,
                rainCardRefraction: 100,
                rainCardBrightness: 100,
                rainFallEnabled: true,
                rainFallDensity: 232,
                rainFallSize: 135,
                splashIntensity: 100,
                rainFallSpeed: 100,
                acMistEnabled: true,
                acMistIntensity: 69,
                acMistSpeed: 169,
                acMistSpread: 88,
                acMistLength: 100,
                acMistAngle: 30,
                bonfireEnabled: true,
                bonfireSize: 100,
                bonfireLight: 100,
                bonfireFlicker: 100,
                bonfireHeight: 100,
                fireflyEnabled: true,
                fireflyDensity: 191,
                fireflySize: 32,
                fireflyGlow: 129,
                fireflySpeed: 100,
                fireflyBlinkFreq: 100
            };
            const saved = localStorage.getItem('studySettings');
            if (saved) {
                const savedSettings = JSON.parse(saved);
                return {
                    ...defaultSettings,
                    ...savedSettings,
                    volume: savedSettings.volume !== undefined ? savedSettings.volume : 50,
                    restReminderTime: savedSettings.restReminderTime !== undefined ? savedSettings.restReminderTime : 50,
                    screenWakeTime: savedSettings.screenWakeTime !== undefined ? savedSettings.screenWakeTime : 3,
                    thunderCloudEnabled: savedSettings.thunderCloudEnabled !== undefined ? savedSettings.thunderCloudEnabled : true,
                    envFxEnabled: savedSettings.envFxEnabled !== undefined ? savedSettings.envFxEnabled : true,
                    thunderCloudAmount: savedSettings.thunderCloudAmount !== undefined ? savedSettings.thunderCloudAmount : 191,
                    thunderCloudFog: savedSettings.thunderCloudFog !== undefined ? savedSettings.thunderCloudFog : 100,
                    thunderCloudOpacity: savedSettings.thunderCloudOpacity !== undefined ? savedSettings.thunderCloudOpacity : 119,
                    thunderCloudThickness: savedSettings.thunderCloudThickness !== undefined ? savedSettings.thunderCloudThickness : 195,
                    thunderCloudClustering: savedSettings.thunderCloudClustering !== undefined ? savedSettings.thunderCloudClustering : 175,
                    thunderCloudSpeed: savedSettings.thunderCloudSpeed !== undefined ? savedSettings.thunderCloudSpeed : 100,
                    thunderCloudBrightness: savedSettings.thunderCloudBrightness !== undefined ? savedSettings.thunderCloudBrightness : 77,
                    thunderLightningFreq: savedSettings.thunderLightningFreq !== undefined ? savedSettings.thunderLightningFreq : 50,
                    thunderCloudQuality: savedSettings.thunderCloudQuality !== undefined ? savedSettings.thunderCloudQuality : 50,
                    rainCardEnabled: savedSettings.rainCardEnabled !== undefined ? savedSettings.rainCardEnabled : true,
                    rainCardDensity: savedSettings.rainCardDensity !== undefined ? savedSettings.rainCardDensity : 98,
                    rainCardDropSize: savedSettings.rainCardDropSize !== undefined ? savedSettings.rainCardDropSize : 134,
                    rainCardRefraction: savedSettings.rainCardRefraction !== undefined ? savedSettings.rainCardRefraction : 100,
                    rainCardBrightness: savedSettings.rainCardBrightness !== undefined ? savedSettings.rainCardBrightness : 100,
                    rainFallEnabled: savedSettings.rainFallEnabled !== undefined ? savedSettings.rainFallEnabled : true,
                    rainFallDensity: savedSettings.rainFallDensity !== undefined ? savedSettings.rainFallDensity : 232,
                    rainFallSize: savedSettings.rainFallSize !== undefined ? savedSettings.rainFallSize : 135,
                    splashIntensity: savedSettings.splashIntensity !== undefined ? savedSettings.splashIntensity : 100,
                    rainFallSpeed: savedSettings.rainFallSpeed !== undefined ? savedSettings.rainFallSpeed : 100,
                    acMistEnabled: savedSettings.acMistEnabled !== undefined ? savedSettings.acMistEnabled : true,
                    acMistIntensity: savedSettings.acMistIntensity !== undefined ? savedSettings.acMistIntensity : 69,
                    acMistSpeed: savedSettings.acMistSpeed !== undefined ? savedSettings.acMistSpeed : 169,
                    acMistSpread: savedSettings.acMistSpread !== undefined ? savedSettings.acMistSpread : 88,
                    acMistLength: savedSettings.acMistLength !== undefined ? savedSettings.acMistLength : 100,
                    acMistAngle: savedSettings.acMistAngle !== undefined ? (savedSettings.acMistAngle === 0 ? 30 : savedSettings.acMistAngle) : 30,
                    bonfireEnabled: savedSettings.bonfireEnabled !== undefined ? savedSettings.bonfireEnabled : true,
                    bonfireSize: savedSettings.bonfireSize !== undefined ? savedSettings.bonfireSize : 100,
                    bonfireLight: savedSettings.bonfireLight !== undefined ? savedSettings.bonfireLight : 100,
                    bonfireFlicker: savedSettings.bonfireFlicker !== undefined ? savedSettings.bonfireFlicker : 100,
                    bonfireHeight: savedSettings.bonfireHeight !== undefined ? savedSettings.bonfireHeight : 100,
                    fireflyEnabled: savedSettings.fireflyEnabled !== undefined ? savedSettings.fireflyEnabled : true,
                    fireflyDensity: savedSettings.fireflyDensity !== undefined ? savedSettings.fireflyDensity : 191,
                    fireflySize: savedSettings.fireflySize !== undefined ? savedSettings.fireflySize : 32,
                    fireflyGlow: savedSettings.fireflyGlow !== undefined ? savedSettings.fireflyGlow : 129,
                    fireflySpeed: savedSettings.fireflySpeed !== undefined ? savedSettings.fireflySpeed : 100,
                    fireflyBlinkFreq: savedSettings.fireflyBlinkFreq !== undefined ? savedSettings.fireflyBlinkFreq : 100
                };
            }
            return defaultSettings;
        }

        function saveSettings() {
            const restReminderTime = document.getElementById('restReminderTime');
            const screenWakeTime = document.getElementById('screenWakeTime');
            const lightOnBtn = document.getElementById('lightOn');
            const settings = {
                autoFullscreen: document.getElementById('autoFullscreen').checked,
                restReminderTime: restReminderTime ? parseInt(restReminderTime.value) || 50 : 50,
                screenWakeTime: screenWakeTime ? parseInt(screenWakeTime.value) || 3 : 3,
                volume: parseInt(document.getElementById('volumeSlider').value) >= 0 ? parseInt(document.getElementById('volumeSlider').value) : 50,
                theme: document.body.classList.contains('theme-square') ? 'square' : 'rounded',
                lightMode: lightOnBtn && lightOnBtn.classList.contains('active') ? 'on' : 'off',
                thunderCloudEnabled: document.getElementById('thunderCloudEnabled') ? document.getElementById('thunderCloudEnabled').checked : true,
                envFxEnabled: document.getElementById('envFxEnabled') ? document.getElementById('envFxEnabled').checked : true,
                thunderCloudAmount: parseInt(document.getElementById('thunderCloudSlider').value) >= 0 ? parseInt(document.getElementById('thunderCloudSlider').value) : 100,
                thunderCloudFog: parseInt(document.getElementById('thunderFogSlider').value) >= 0 ? parseInt(document.getElementById('thunderFogSlider').value) : 0,
                thunderCloudOpacity: parseInt(document.getElementById('thunderCloudOpacitySlider').value) >= 0 ? parseInt(document.getElementById('thunderCloudOpacitySlider').value) : 100,
                thunderCloudThickness: parseInt(document.getElementById('thunderCloudThicknessSlider').value) >= 0 ? parseInt(document.getElementById('thunderCloudThicknessSlider').value) : 50,
                thunderCloudClustering: parseInt(document.getElementById('thunderCloudClusteringSlider').value) >= 0 ? parseInt(document.getElementById('thunderCloudClusteringSlider').value) : 50,
                thunderCloudSpeed: parseInt(document.getElementById('thunderCloudSpeedSlider').value) >= 0 ? parseInt(document.getElementById('thunderCloudSpeedSlider').value) : 100,
                thunderCloudBrightness: parseInt(document.getElementById('thunderCloudBrightnessSlider').value) >= 0 ? parseInt(document.getElementById('thunderCloudBrightnessSlider').value) : 100,
                thunderLightningFreq: parseInt(document.getElementById('thunderLightningSlider').value) >= 0 ? parseInt(document.getElementById('thunderLightningSlider').value) : 50,
                thunderCloudQuality: parseInt(document.getElementById('thunderQualitySlider').value) >= 0 ? parseInt(document.getElementById('thunderQualitySlider').value) : 50,
                rainCardEnabled: document.getElementById('rainCardEnabled') ? document.getElementById('rainCardEnabled').checked : true,
                rainCardDensity: parseInt(document.getElementById('rainCardDensitySlider').value) >= 0 ? parseInt(document.getElementById('rainCardDensitySlider').value) : 100,
                rainCardDropSize: parseInt(document.getElementById('rainCardDropSizeSlider').value) >= 0 ? parseInt(document.getElementById('rainCardDropSizeSlider').value) : 100,
                rainCardRefraction: parseInt(document.getElementById('rainCardRefractionSlider').value) >= 0 ? parseInt(document.getElementById('rainCardRefractionSlider').value) : 100,
                rainCardBrightness: parseInt(document.getElementById('rainCardBrightnessSlider').value) >= 0 ? parseInt(document.getElementById('rainCardBrightnessSlider').value) : 100,
                rainFallEnabled: document.getElementById('rainFallEnabled') ? document.getElementById('rainFallEnabled').checked : true,
                rainFallDensity: parseInt(document.getElementById('rainFallDensitySlider').value) >= 0 ? parseInt(document.getElementById('rainFallDensitySlider').value) : 100,
                rainFallSize: parseInt(document.getElementById('rainFallSizeSlider').value) >= 0 ? parseInt(document.getElementById('rainFallSizeSlider').value) : 100,
                splashIntensity: parseInt(document.getElementById('splashIntensitySlider').value) >= 0 ? parseInt(document.getElementById('splashIntensitySlider').value) : 100,
                rainFallSpeed: parseInt(document.getElementById('rainFallSpeedSlider').value) >= 0 ? parseInt(document.getElementById('rainFallSpeedSlider').value) : 100,
                acMistEnabled: document.getElementById('acMistEnabled') ? document.getElementById('acMistEnabled').checked : true,
                acMistIntensity: parseInt(document.getElementById('acMistIntensitySlider').value) >= 0 ? parseInt(document.getElementById('acMistIntensitySlider').value) : 80,
                acMistSpeed: parseInt(document.getElementById('acMistSpeedSlider').value) >= 0 ? parseInt(document.getElementById('acMistSpeedSlider').value) : 100,
                acMistSpread: parseInt(document.getElementById('acMistSpreadSlider').value) >= 0 ? parseInt(document.getElementById('acMistSpreadSlider').value) : 100,
                acMistLength: parseInt(document.getElementById('acMistLengthSlider').value) >= 0 ? parseInt(document.getElementById('acMistLengthSlider').value) : 100,
                acMistAngle: parseInt(document.getElementById('acMistAngleSlider').value),
                bonfireEnabled: document.getElementById('bonfireEnabled') ? document.getElementById('bonfireEnabled').checked : true,
                bonfireSize: parseInt(document.getElementById('bonfireSizeSlider').value) >= 0 ? parseInt(document.getElementById('bonfireSizeSlider').value) : 100,
                bonfireLight: parseInt(document.getElementById('bonfireLightSlider').value) >= 0 ? parseInt(document.getElementById('bonfireLightSlider').value) : 100,
                bonfireFlicker: parseInt(document.getElementById('bonfireFlickerSlider').value) >= 0 ? parseInt(document.getElementById('bonfireFlickerSlider').value) : 100,
                bonfireHeight: parseInt(document.getElementById('bonfireHeightSlider').value) >= 0 ? parseInt(document.getElementById('bonfireHeightSlider').value) : 100,
                fireflyEnabled: document.getElementById('fireflyEnabled') ? document.getElementById('fireflyEnabled').checked : true,
                fireflyDensity: parseInt(document.getElementById('fireflyDensitySlider').value) >= 0 ? parseInt(document.getElementById('fireflyDensitySlider').value) : 100,
                fireflySize: parseInt(document.getElementById('fireflySizeSlider').value) >= 0 ? parseInt(document.getElementById('fireflySizeSlider').value) : 100,
                fireflyGlow: parseInt(document.getElementById('fireflyGlowSlider').value) >= 0 ? parseInt(document.getElementById('fireflyGlowSlider').value) : 100,
                fireflySpeed: parseInt(document.getElementById('fireflySpeedSlider').value) >= 0 ? parseInt(document.getElementById('fireflySpeedSlider').value) : 100,
                fireflyBlinkFreq: parseInt(document.getElementById('fireflyBlinkFreqSlider').value) >= 0 ? parseInt(document.getElementById('fireflyBlinkFreqSlider').value) : 100
            };
            localStorage.setItem('studySettings', JSON.stringify(settings));
        }

        function updateVolume() {
            const volumeSlider = document.getElementById('volumeSlider');
            const volumeValue = document.getElementById('volumeValue');
            if (volumeSlider && volumeValue) {
                const volume = parseInt(volumeSlider.value) || 50;
                volumeValue.textContent = volume + '%';
                audioTargetVolume = volume / 100;
                if (!audioFadingOut) {
                    document.getElementById('bgMusic').volume = audioTargetVolume;
                }
                saveSettings();
            }
        }

        function thunderQualityLabel(val) {
            if (val < 25) return '低';
            if (val < 55) return '中';
            if (val < 80) return '高';
            return '超高';
        }

        function thunderLightningLabel(val) {
            if (val <= 0) return '关闭';
            if (val < 25) return '很低';
            if (val < 50) return '低';
            if (val < 75) return '中';
            return '高';
        }

        function getThunderUniforms() {
            const s = getSettings();
            // 云量 0~200 统一控制整体浓度
            // threshold 越小云越多，coverage 越大云覆盖越多
            const amount = Math.max(0, Math.min(200, s.thunderCloudAmount));
            const threshold = Math.max(0.02, 0.70 - amount * 0.0031);
            const coverage = 0.10 + amount * 0.006;
            const quality = Math.max(0, Math.min(100, s.thunderCloudQuality));
            return { threshold, coverage, quality };
        }

        function getThunderBackOpacity() {
            const s = getSettings();
            const amount = Math.max(0, Math.min(200, s.thunderCloudAmount));
            const opacity = Math.max(0, Math.min(100, s.thunderCloudOpacity));
            // 云量 0 时完全透明；200% 时 opacity 到顶
            return Math.min(1.0, (amount / 200) * (opacity / 100));
        }

        function updateThunderSettings() {
            const cloudSlider = document.getElementById('thunderCloudSlider');
            const cloudValue = document.getElementById('thunderCloudValue');
            const fogSlider = document.getElementById('thunderFogSlider');
            const fogValue = document.getElementById('thunderFogValue');
            const opacitySlider = document.getElementById('thunderCloudOpacitySlider');
            const opacityValue = document.getElementById('thunderCloudOpacityValue');
            const thicknessSlider = document.getElementById('thunderCloudThicknessSlider');
            const thicknessValue = document.getElementById('thunderCloudThicknessValue');
            const clusteringSlider = document.getElementById('thunderCloudClusteringSlider');
            const clusteringValue = document.getElementById('thunderCloudClusteringValue');
            const speedSlider = document.getElementById('thunderCloudSpeedSlider');
            const speedValue = document.getElementById('thunderCloudSpeedValue');
            const brightnessSlider = document.getElementById('thunderCloudBrightnessSlider');
            const brightnessValue = document.getElementById('thunderCloudBrightnessValue');
            const lightningSlider = document.getElementById('thunderLightningSlider');
            const lightningValue = document.getElementById('thunderLightningValue');
            const qualitySlider = document.getElementById('thunderQualitySlider');
            const qualityValue = document.getElementById('thunderQualityValue');

            if (cloudSlider && cloudValue) cloudValue.textContent = cloudSlider.value + '%';
            if (fogSlider && fogValue) fogValue.textContent = fogSlider.value + '%';
            if (opacitySlider && opacityValue) opacityValue.textContent = opacitySlider.value + '%';
            if (thicknessSlider && thicknessValue) thicknessValue.textContent = thicknessSlider.value + '%';
            if (clusteringSlider && clusteringValue) clusteringValue.textContent = clusteringSlider.value + '%';
            if (speedSlider && speedValue) speedValue.textContent = speedSlider.value + '%';
            if (brightnessSlider && brightnessValue) brightnessValue.textContent = brightnessSlider.value + '%';
            if (lightningSlider && lightningValue) lightningValue.textContent = thunderLightningLabel(parseInt(lightningSlider.value));
            if (qualitySlider && qualityValue) qualityValue.textContent = thunderQualityLabel(parseInt(qualitySlider.value));

            saveSettings();

            // 如果正在渲染雷雨声，实时更新前后景云量
            if (thunderScenes && thunderScenes.scene) {
                const s = getSettings();
                const u = getThunderUniforms();
                thunderScenes.scene.uniforms.uThreshold.value = u.threshold;
                if (thunderScenes.scene.uniforms.uSpeed !== undefined) {
                    thunderScenes.scene.uniforms.uSpeed.value = s.thunderCloudSpeed / 100;
                }
                if (thunderScenes.scene.uniforms.uBrightness !== undefined) {
                    thunderScenes.scene.uniforms.uBrightness.value = s.thunderCloudBrightness / 100;
                }
                if (thunderScenes.scene.uniforms.uThickness !== undefined) {
                    thunderScenes.scene.uniforms.uThickness.value = s.thunderCloudThickness / 100;
                }
                if (thunderScenes.scene.uniforms.uClustering !== undefined) {
                    thunderScenes.scene.uniforms.uClustering.value = s.thunderCloudClustering / 100;
                }
                if (thunderScenes.scene.uniforms.uCloudOpacity !== undefined) {
                    thunderScenes.scene.uniforms.uCloudOpacity.value = s.thunderCloudOpacity / 100;
                }
                const amount = s.thunderCloudAmount;
                const opacity = getThunderBackOpacity();
                const backC = document.getElementById('thunderCloudBack');
                if (backC) {
                    backC.style.transition = amount <= 0 ? 'none' : 'opacity 1.2s ease';
                    backC.style.opacity = String(opacity);
                }
                // 全局雾气层
                const fogOverlay = document.getElementById('thunderFogOverlay');
                if (fogOverlay) fogOverlay.style.opacity = String(Math.max(0, Math.min(100, s.thunderCloudFog)) / 100);
                // 前景云：云量或亮度改变时重新生成并同步透明度
                addThunderFrontClouds();
                const brightness = (s.thunderCloudBrightness || 100) / 100;
                const puffOpacity = Math.max(0.08, 0.32 * Math.min(1.2, brightness + 0.1));
                document.querySelectorAll('.thunder-front-puff').forEach(p => {
                    p.style.setProperty('--puff-opacity', puffOpacity.toFixed(3));
                });
                // 闪电频率改变后重新调度
                startThunderLightning();
            }
        }

        function applyTheme(theme, animate = true) {
            const body = document.body;
            const roundedBtn = document.getElementById('themeRounded');
            const squareBtn = document.getElementById('themeSquare');
            if (!roundedBtn || !squareBtn) return;

            if (animate) {
                body.classList.add('theme-transition');
            }

            if (theme === 'square') {
                body.classList.add('theme-square');
                roundedBtn.classList.remove('active');
                squareBtn.classList.add('active');
            } else {
                body.classList.remove('theme-square');
                roundedBtn.classList.add('active');
                squareBtn.classList.remove('active');
            }

            if (animate) {
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        body.classList.remove('theme-transition');
                    }, 420);
                });
            }
        }

        function setTheme(theme) {
            applyTheme(theme, true);
            saveSettings();
        }

        function applyLightMode(mode) {
            // 委托到异步版本
            applyLightModeAsync(mode);
        }

        async function transitionLightMode(mode) {
            const parallaxContainer = document.getElementById('parallaxContainer');
            const parallaxBg = document.querySelector('.parallax-bg');
            const studyBg = document.getElementById('studyBg');
            const bgOverlay = document.getElementById('bgOverlay');
            if (!parallaxContainer) return;

            const existing = parallaxContainer.querySelector('.parallax-bg-transition');
            if (existing) existing.remove();

            let currentImage = '';
            if (bgOverlay && bgOverlay.classList.contains('active') && bgOverlay.style.backgroundImage) {
                currentImage = bgOverlay.style.backgroundImage;
            } else if (studyBg && studyBg.classList.contains('active') && studyBg.style.backgroundImage) {
                currentImage = studyBg.style.backgroundImage;
            } else if (parallaxBg) {
                currentImage = parallaxBg.style.backgroundImage || getComputedStyle(parallaxBg).backgroundImage;
            }

            const transition = document.createElement('div');
            transition.className = 'parallax-bg-transition';
            transition.style.backgroundImage = currentImage;
            transition.style.opacity = '1';
            parallaxContainer.appendChild(transition);

            await applyLightModeAsync(mode);

            requestAnimationFrame(() => {
                transition.style.opacity = '0';
            });
            setTimeout(() => transition.remove(), 800);
        }

        function setLightMode(mode) {
            transitionLightMode(mode);
            saveSettings();
        }

        function exportRecords() {
            const data = {
                records: records,
                trashRecords: JSON.parse(localStorage.getItem('trashRecords') || '[]'),
                exportTime: new Date().toISOString()
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `自习记录_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('记录导出成功！');
        }

        function importRecords() {
            document.getElementById('importFile').click();
        }

        document.getElementById('importFile').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const data = JSON.parse(event.target.result);
                    if (data.records && Array.isArray(data.records)) {
                        records = [...records, ...data.records];
                        saveRecords();
                        if (data.trashRecords && Array.isArray(data.trashRecords)) {
                            localStorage.setItem('trashRecords', JSON.stringify(data.trashRecords));
                        }
                        alert('记录导入成功！');
                    } else {
                        alert('无效的文件格式！');
                    }
                } catch (error) {
                    alert('文件解析失败！');
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        });

        function clearAllRecords() {
            if (!confirm('确定要清空所有记录吗？此操作不可撤销！')) return;
            records = [];
            saveRecords();
            localStorage.removeItem('trashRecords');
            alert('所有记录已清空！');
        }

        // 监听设置变化
        document.getElementById('autoFullscreen').addEventListener('change', saveSettings);
        document.getElementById('restReminderTime').addEventListener('change', saveSettings);
        document.getElementById('restReminderTime').addEventListener('input', saveSettings);
        document.getElementById('screenWakeTime').addEventListener('change', () => {
            saveSettings();
            if (isStudying) startWakeLockTimer();
        });
        document.getElementById('screenWakeTime').addEventListener('input', saveSettings);
        document.getElementById('volumeSlider').addEventListener('input', updateVolume);
        // 环境特效总开关
        document.getElementById('envFxEnabled').addEventListener('change', function() {
            saveSettings();
            updateEnvFxParamsRow();
            const settings = getSettings();
            // 总开关关闭时，移除所有当前活跃的特效
            if (!settings.envFxEnabled) {
                removeThunderClouds();
                removeRainCardEffects();
                destroyRainFall();
                removeAcMist();
                removeBonfire();
                removeFireflies();
            } else {
                // 总开关打开时，根据当前音效恢复对应特效
                if (currentSoundIndex === 6 && settings.thunderCloudEnabled) addThunderClouds();
                if (currentSoundIndex === 6) { addRainCardEffects(); createRainFall(); }
                if (currentSoundIndex === 2 && settings.acMistEnabled) addAcMist();
                if (currentSoundIndex === 5 && settings.bonfireEnabled) addBonfire();
                if (currentSoundIndex === 1 && settings.fireflyEnabled) addFireflies();
            }
            // 更新所有子项的置灰状态
            updateThunderCloudParamsRow();
            updateRainCardParamsRow();
            updateRainFallParamsRow();
            updateAcMistParamsRow();
            updateBonfireParamsRow();
            updateFireflyParamsRow();
        });

        document.getElementById('thunderCloudEnabled').addEventListener('change', function() {
            saveSettings();
            updateThunderCloudParamsRow();
            if (currentSoundIndex === 6) {
                if (this.checked) {
                    addThunderClouds();
                } else {
                    removeThunderClouds();
                }
            }
        });
        document.getElementById('thunderCloudSlider').addEventListener('input', updateThunderSettings);
        document.getElementById('thunderCloudSlider').addEventListener('change', updateThunderSettings);
        document.getElementById('thunderFogSlider').addEventListener('input', updateThunderSettings);
        document.getElementById('thunderFogSlider').addEventListener('change', updateThunderSettings);
        document.getElementById('thunderCloudOpacitySlider').addEventListener('input', updateThunderSettings);
        document.getElementById('thunderCloudOpacitySlider').addEventListener('change', updateThunderSettings);
        document.getElementById('thunderCloudThicknessSlider').addEventListener('input', updateThunderSettings);
        document.getElementById('thunderCloudThicknessSlider').addEventListener('change', updateThunderSettings);
        document.getElementById('thunderCloudClusteringSlider').addEventListener('input', updateThunderSettings);
        document.getElementById('thunderCloudClusteringSlider').addEventListener('change', updateThunderSettings);
        document.getElementById('thunderCloudSpeedSlider').addEventListener('input', updateThunderSettings);
        document.getElementById('thunderCloudSpeedSlider').addEventListener('change', updateThunderSettings);
        document.getElementById('thunderCloudBrightnessSlider').addEventListener('input', updateThunderSettings);
        document.getElementById('thunderCloudBrightnessSlider').addEventListener('change', updateThunderSettings);
        document.getElementById('thunderLightningSlider').addEventListener('input', updateThunderSettings);
        document.getElementById('thunderLightningSlider').addEventListener('change', updateThunderSettings);
        document.getElementById('thunderQualitySlider').addEventListener('input', updateThunderSettings);
        document.getElementById('thunderQualitySlider').addEventListener('change', () => {
            updateThunderSettings();
            // 画质改变需要重建 renderer 才能生效分辨率
            if (currentSoundIndex === 6) {
                removeThunderCloudsImmediate();
                setTimeout(addThunderClouds, 50);
            }
        });

        document.getElementById('rainCardEnabled').addEventListener('change', function() {
            saveSettings();
            if (typeof updateRainCardParamsRow === 'function') updateRainCardParamsRow();
            if (typeof updateRainFallParamsRow === 'function') updateRainFallParamsRow();
            if (currentSoundIndex === 0 || currentSoundIndex === 5) {
                if (this.checked) {
                    addRainCardEffects();
                    if (getSettings().rainFallEnabled) {
                        // 下雨效果在雨滴效果开启后自动启动
                    }
                } else {
                    removeRainCardEffects();
                }
            }
        });
        document.getElementById('rainCardDensitySlider').addEventListener('input', function() {
            document.getElementById('rainCardDensityValue').textContent = this.value + '%';
            updateRainCardSettings();
            saveSettings();
        });
        document.getElementById('rainCardDensitySlider').addEventListener('change', function() {
            saveSettings();
        });
        document.getElementById('rainCardDropSizeSlider').addEventListener('input', function() {
            document.getElementById('rainCardDropSizeValue').textContent = this.value + '%';
            updateRainCardSettings();
            saveSettings();
        });
        document.getElementById('rainCardDropSizeSlider').addEventListener('change', function() {
            saveSettings();
        });
        document.getElementById('rainCardRefractionSlider').addEventListener('input', function() {
            document.getElementById('rainCardRefractionValue').textContent = this.value + '%';
            updateRainCardSettings();
            saveSettings();
        });
        document.getElementById('rainCardRefractionSlider').addEventListener('change', function() {
            saveSettings();
        });
        document.getElementById('rainCardBrightnessSlider').addEventListener('input', function() {
            document.getElementById('rainCardBrightnessValue').textContent = this.value + '%';
            updateRainCardSettings();
            saveSettings();
        });
        document.getElementById('rainCardBrightnessSlider').addEventListener('change', function() {
            saveSettings();
        });

        // 下雨效果开关
        document.getElementById('rainFallEnabled').addEventListener('change', function() {
            saveSettings();
            if (typeof updateRainFallParamsRow === 'function') updateRainFallParamsRow();
            if (currentSoundIndex === 0 || currentSoundIndex === 5) {
                if (this.checked) {
                    if (!rainFallCanvas) {
                        createRainFall();
                        updateRainFallSettings();
                    }
                } else {
                    destroyRainFall();
                }
            }
        });

        // 下雨效果参数滑块
        document.getElementById('rainFallDensitySlider').addEventListener('input', function() {
            document.getElementById('rainFallDensityValue').textContent = this.value + '%';
            updateRainFallSettings();
            saveSettings();
        });
        document.getElementById('rainFallDensitySlider').addEventListener('change', function() {
            saveSettings();
        });
        document.getElementById('rainFallSizeSlider').addEventListener('input', function() {
            document.getElementById('rainFallSizeValue').textContent = this.value + '%';
            updateRainFallSettings();
            saveSettings();
        });
        document.getElementById('rainFallSizeSlider').addEventListener('change', function() {
            saveSettings();
        });
        document.getElementById('splashIntensitySlider').addEventListener('input', function() {
            document.getElementById('splashIntensityValue').textContent = this.value + '%';
            updateRainFallSettings();
            saveSettings();
        });
        document.getElementById('splashIntensitySlider').addEventListener('change', function() {
            saveSettings();
        });
        document.getElementById('rainFallSpeedSlider').addEventListener('input', function() {
            document.getElementById('rainFallSpeedValue').textContent = this.value + '%';
            updateRainFallSettings();
            saveSettings();
        });
        document.getElementById('rainFallSpeedSlider').addEventListener('change', function() {
            saveSettings();
        });

        // 冷气白雾参数滑块
        ['acMistIntensity', 'acMistSpeed', 'acMistSpread', 'acMistLength'].forEach(function(id) {
            document.getElementById(id + 'Slider').addEventListener('input', function() {
                document.getElementById(id + 'Value').textContent = this.value + '%';
                saveSettings();
                updateAcMistSettings();
            });
        });

        // 追踪范围滑块（显示角度值）
        document.getElementById('acMistAngleSlider').addEventListener('input', function() {
            const v = parseInt(this.value);
            document.getElementById('acMistAngleValue').textContent = v + '°';
            saveSettings();
            updateAcMistSettings();
        });

        // 冷气白雾开关
        document.getElementById('acMistEnabled').addEventListener('change', function() {
            saveSettings();
            const settings = getSettings();
            if (currentSoundIndex === 2) {
                if (settings.acMistEnabled) {
                    addAcMist();
                } else {
                    removeAcMist();
                }
            }
            updateAcMistParamsRow();
        });

        function updateAcMistParamsRow() {
            const settings = getSettings();
            const row = document.getElementById('acMistParamsRow');
            if (row) {
                if (settings.acMistEnabled && settings.envFxEnabled) {
                    row.classList.remove('setting-item-disabled');
                } else {
                    row.classList.add('setting-item-disabled');
                }
            }
        }

        // 篝火光照参数滑块
        ['bonfireSize', 'bonfireLight', 'bonfireFlicker', 'bonfireHeight'].forEach(function(id) {
            document.getElementById(id + 'Slider').addEventListener('input', function() {
                document.getElementById(id + 'Value').textContent = this.value + '%';
                saveSettings();
                updateBonfireSettings();
            });
        });

        // 篝火光照开关
        document.getElementById('bonfireEnabled').addEventListener('change', function() {
            saveSettings();
            const settings = getSettings();
            if (currentSoundIndex === 5) {
                if (settings.bonfireEnabled) {
                    addBonfire();
                } else {
                    removeBonfire();
                }
            }
            updateBonfireParamsRow();
        });

        // 萤火虫参数滑块
        ['fireflyDensity', 'fireflySize', 'fireflyGlow', 'fireflySpeed', 'fireflyBlinkFreq'].forEach(function(id) {
            document.getElementById(id + 'Slider').addEventListener('input', function() {
                document.getElementById(id + 'Value').textContent = this.value + '%';
                saveSettings();
                updateFireflySettings();
            });
        });

        // 萤火虫开关
        document.getElementById('fireflyEnabled').addEventListener('change', function() {
            saveSettings();
            const settings = getSettings();
            if (currentSoundIndex === 1) {
                if (settings.fireflyEnabled) {
                    addFireflies();
                } else {
                    removeFireflies();
                }
            }
            updateFireflyParamsRow();
        });

        function updateBonfireParamsRow() {
            const settings = getSettings();
            const row = document.getElementById('bonfireParamsRow');
            if (row) {
                if (settings.bonfireEnabled && settings.envFxEnabled) {
                    row.classList.remove('setting-item-disabled');
                } else {
                    row.classList.add('setting-item-disabled');
                }
            }
        }

        // 实时更新篝火参数
        function updateBonfireSettings() {
            if (!bonfireScene) return;
            const settings = getSettings();
            const uniforms = bonfireScene.uniforms;
            uniforms.uSize.value = settings.bonfireSize / 100;
            uniforms.uLight.value = settings.bonfireLight / 100;
            uniforms.uFlicker.value = settings.bonfireFlicker / 100;
            uniforms.uHeight.value = settings.bonfireHeight / 100;
        }

        document.getElementById('themeRounded').addEventListener('click', () => setTheme('rounded'));
        document.getElementById('themeSquare').addEventListener('click', () => setTheme('square'));
        document.getElementById('lightOn').addEventListener('click', () => setLightMode('on'));
        document.getElementById('lightOff').addEventListener('click', () => setLightMode('off'));

        // 玻璃球点击切换灯光
        document.querySelectorAll('.glass-orb').forEach(orb => {
            orb.addEventListener('click', function() {
                // 点击发光效果
                this.classList.remove('clicked', 'fading');
                // 强制 reflow 以重新触发动画
                void this.offsetWidth;
                this.classList.add('clicked');
                // 延迟后添加 fading 类实现渐退
                setTimeout(() => {
                    this.classList.add('fading');
                }, 300);
                // 完全移除效果类
                setTimeout(() => {
                    this.classList.remove('clicked', 'fading');
                }, 1200);

                const currentMode = getSettings().lightMode || 'on';
                setLightMode(currentMode === 'on' ? 'off' : 'on');
            });
        });

        function showSoundModal() {
            const soundList = document.getElementById('soundList');
            soundList.innerHTML = '';

            soundFiles.forEach((sound, index) => {
                const item = document.createElement('div');
                const isActive = index === currentSoundIndex;
                const isHeartbeat = index === 3;
                item.className = 'sound-item' + (isActive ? ' active' : '');
                item.innerHTML = `
                    <span class="sound-item-name" style="color: ${isActive ? sound.color : 'white'}">${sound.name}</span>
                    <span class="sound-item-icon">${isActive ? '🔊' : '🔇'}</span>
                `;
                if (isActive) {
                    item.style.background = sound.color + '40';
                    item.style.borderColor = sound.color;
                    if (isHeartbeat) {
                        item.style.animation = 'heartbeat 2s ease-in-out infinite';
                    } else {
                        item.style.boxShadow = `inset 2px -2px 3px -1px rgba(255, 255, 255, 0.8), inset -2px 2px 3px -1px rgba(255, 255, 255, 0.8), 0 6px 16px ${sound.color}80`;
                    }
                }
                item.onclick = () => selectSound(index);
                soundList.appendChild(item);
            });

            document.getElementById('soundModal').classList.add('active');
        }

        function addRaindrops() {
            const settings = getSettings();
            // 如果雨滴卡片效果已开启，则不添加CSS雨滴（卡片效果会替代）
            if (!settings.rainCardEnabled) {
                const orbs = document.querySelectorAll('.glass-orb');
                orbs.forEach(orb => {
                    for (let i = 0; i < 8; i++) {
                        const drop = document.createElement('div');
                        drop.className = 'rain-drop';
                        drop.style.left = Math.random() * 100 + '%';
                        drop.style.animationDelay = Math.random() * 0.8 + 's';
                        drop.style.animationDuration = (0.6 + Math.random() * 0.4) + 's';
                        orb.appendChild(drop);
                    }
                });
            }
            startLightningEffect();
        }

        function removeRaindrops() {
            const drops = document.querySelectorAll('.rain-drop');
            drops.forEach(drop => drop.remove());
            stopLightningEffect();
        }

        let lightningInterval = null;

        function triggerLightning() {
            const orbs = document.querySelectorAll('.glass-orb');
            orbs.forEach(orb => {
                orb.classList.add('lightning');
            });
            setTimeout(() => {
                orbs.forEach(orb => {
                    orb.classList.remove('lightning');
                });
            }, 300);
        }

        function startLightningEffect() {
            stopLightningEffect();
            const scheduleNext = () => {
                const delay = (10 + Math.random() * 20) * 1000;
                lightningInterval = setTimeout(() => {
                    triggerLightning();
                    scheduleNext();
                }, delay);
            };
            scheduleNext();
        }

        function stopLightningEffect() {
            if (lightningInterval) {
                clearTimeout(lightningInterval);
                lightningInterval = null;
            }
        }

        function addFireEffects() {
            const timeDisplays = document.querySelectorAll('.current-time, .study-display, #timerDisplay, #studyDisplay, .time-display');
            
            timeDisplays.forEach(display => {
                if (!display.classList.contains('fire-glow')) {
                    display.classList.add('fire-glow');
                    createFireParticles(display);
                    createEmbers(display);
                }
            });
        }

        function createFireParticles(element) {
            for (let i = 0; i < 6; i++) {
                const particle = document.createElement('span');
                particle.className = 'fire-particle';
                particle.style.left = (30 + Math.random() * 40) + '%';
                particle.style.animationDelay = Math.random() * 1.5 + 's';
                particle.style.animationDuration = (1 + Math.random() * 0.5) + 's';
                element.appendChild(particle);
            }
        }

        function createEmbers(element) {
            for (let i = 0; i < 4; i++) {
                const ember = document.createElement('span');
                ember.className = 'ember';
                ember.style.left = (20 + Math.random() * 60) + '%';
                ember.style.animationDelay = Math.random() * 2 + 's';
                ember.style.animationDuration = (1.5 + Math.random() * 1) + 's';
                element.appendChild(ember);
            }
        }

        function removeFireEffects() {
            const elements = document.querySelectorAll('.fire-glow');
            const particles = document.querySelectorAll('.fire-particle, .ember');
            
            elements.forEach(el => {
                el.classList.remove('fire-glow');
            });
            
            particles.forEach(p => p.remove());
        }

        function addCloudEffects() {
            // 云效果已移除（保留函数接口）
        }

        function removeCloudEffects() {
            // 清理残留的云层元素
            document.querySelectorAll('.cloud-layer').forEach(el => el.remove());
            stopLightningEffect();
        }

        function addDisplayRain() {
            const displayIds = ['currentTime', 'studyDisplay'];
            displayIds.forEach(id => {
                const display = document.getElementById(id);
                if (!display) return;
                const displayRect = display.getBoundingClientRect();
                if (displayRect.width === 0 || displayRect.height === 0) return;
                const existing = display.querySelector('.display-rain');
                if (existing) {
                    const existingRect = existing.getBoundingClientRect();
                    if (existingRect.width > 0 && existingRect.height > 0 && !existing.classList.contains('fading-out')) {
                        return;
                    }
                    existing.remove();
                }
                const rain = document.createElement('div');
                rain.className = 'display-rain';
                const dropCount = 60;
                for (let i = 0; i < dropCount; i++) {
                    const drop = document.createElement('div');
                    drop.className = 'display-rain-drop';
                    const section = i / dropCount;
                    drop.style.left = (section * 100 + Math.random() * 60 - 30) + '%';
                    const duration = 0.45 + Math.random() * 0.35;
                    drop.style.animationDuration = duration + 's';
                    drop.style.animationDelay = (-Math.random() * duration) + 's';
                    rain.appendChild(drop);
                }
                display.appendChild(rain);
            });
        }

        function removeDisplayRain() {
            document.querySelectorAll('.display-rain').forEach(el => {
                el.classList.add('fading-out');
                setTimeout(() => el.remove(), 800);
            });
        }

        function applySoundButtonStyle(index) {
            const soundBtn = document.getElementById('soundBtn');
            const soundColor = soundFiles[index].color;
            soundBtn.classList.add('playing');

            removeRaindrops();
            removeFireEffects();
            removeBonfire();
            removeCloudEffects();
            removeDisplayRain();
            removeThunderClouds();
            removeRainCardEffects();

            if (index === 0) {
                // 雨声：全屏下雨 + 雨滴划过
                soundBtn.style.animation = 'none';
                soundBtn.style.background = soundColor + '30';
                soundBtn.style.borderColor = soundColor + '80';
                soundBtn.style.boxShadow = `inset 2px -2px 3px -1px rgba(255, 255, 255, 0.8), inset -2px 2px 3px -1px rgba(255, 255, 255, 0.8), 0 4px 12px ${soundColor}50`;
                if (getSettings().envFxEnabled) {
                    setTimeout(() => {
                        addCloudEffects();
                        addDisplayRain();
                        if (getSettings().rainFallEnabled) {
                            createRainFall();
                            updateRainFallSettings();
                        }
                        if (getSettings().rainCardEnabled) {
                            addRainCardEffects();
                        }
                    }, 100);
                }
            } else if (index === 1) {
                // 森林午夜：萤火虫飞舞
                soundBtn.style.animation = 'none';
                soundBtn.style.background = soundColor + '30';
                soundBtn.style.borderColor = soundColor + '80';
                soundBtn.style.boxShadow = `inset 2px -2px 3px -1px rgba(255, 255, 255, 0.8), inset -2px 2px 3px -1px rgba(255, 255, 255, 0.8), 0 4px 12px ${soundColor}50`;
                if (getSettings().envFxEnabled && getSettings().fireflyEnabled) {
                    setTimeout(() => {
                        addFireflies();
                    }, 100);
                }
            } else if (index === 2) {
                // 空调：从屏幕上方中间向下扩散的白雾
                soundBtn.style.animation = 'none';
                soundBtn.style.background = soundColor + '30';
                soundBtn.style.borderColor = soundColor + '80';
                soundBtn.style.boxShadow = `inset 2px -2px 3px -1px rgba(255, 255, 255, 0.8), inset -2px 2px 3px -1px rgba(255, 255, 255, 0.8), 0 4px 12px ${soundColor}50`;
                if (getSettings().envFxEnabled && getSettings().acMistEnabled) {
                    setTimeout(() => {
                        addAcMist();
                    }, 100);
                }
            } else if (index === 3) {
                soundBtn.style.animation = 'heartbeatGlow 2s ease-in-out infinite';
                soundBtn.style.background = '#a4b0be30';
                soundBtn.style.borderColor = '#a4b0be80';
                soundBtn.style.boxShadow = 'inset 2px -2px 3px -1px rgba(255, 255, 255, 0.8), inset -2px 2px 3px -1px rgba(255, 255, 255, 0.8), 0 4px 12px #a4b0be50';
            } else if (index === 5) {
                // 篝火风雨：全屏下雨 + 雨滴划过 + 篝火雨滴
                soundBtn.style.animation = 'none';
                soundBtn.style.background = soundColor + '30';
                soundBtn.style.borderColor = soundColor + '80';
                soundBtn.style.boxShadow = `inset 2px -2px 3px -1px rgba(255, 255, 255, 0.8), inset -2px 2px 3px -1px rgba(255, 255, 255, 0.8), 0 4px 12px ${soundColor}50`;
                setTimeout(() => {
                    addRaindrops();
                    addFireEffects();
                    if (getSettings().envFxEnabled && getSettings().bonfireEnabled) addBonfire();
                    addDisplayRain();
                    if (getSettings().envFxEnabled) {
                        if (getSettings().rainFallEnabled) {
                            createRainFall();
                            updateRainFallSettings();
                        }
                        if (getSettings().rainCardEnabled) {
                            addRainCardEffects();
                        }
                    }
                }, 100);
            } else if (index === 6) {
                // 雷雨声：仅云雾效果（无全屏下雨、无雨滴划过、无组件滴水）
                soundBtn.style.animation = 'none';
                soundBtn.style.background = soundColor + '30';
                soundBtn.style.borderColor = soundColor + '80';
                soundBtn.style.boxShadow = `inset 2px -2px 3px -1px rgba(255, 255, 255, 0.8), inset -2px 2px 3px -1px rgba(255, 255, 255, 0.8), 0 4px 12px ${soundColor}50`;
                setTimeout(() => {
                    addCloudEffects();
                    if (getSettings().envFxEnabled && getSettings().thunderCloudEnabled) {
                        addThunderClouds();
                    }
                }, 100);
            } else {
                soundBtn.style.animation = 'none';
                soundBtn.style.background = soundColor + '30';
                soundBtn.style.borderColor = soundColor + '80';
                soundBtn.style.boxShadow = `inset 2px -2px 3px -1px rgba(255, 255, 255, 0.8), inset -2px 2px 3px -1px rgba(255, 255, 255, 0.8), 0 4px 12px ${soundColor}50`;
            }
        }

        function clearSoundButtonStyle() {
            const soundBtn = document.getElementById('soundBtn');
            soundBtn.classList.remove('playing');
            soundBtn.style.animation = 'none';
            soundBtn.style.background = 'rgba(255, 255, 255, 0.08)';
            soundBtn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            soundBtn.style.boxShadow = 'inset 2px -2px 2px -1px rgba(255, 255, 255, 0.7), inset -2px 2px 2px -1px rgba(255, 255, 255, 0.7), inset 4px -4px 1px -3px rgba(255, 255, 255, 0.4), inset -4px 4px 1px -3px rgba(255, 255, 255, 0.4), 0 4px 8px rgba(0, 0, 0, 0.15)';
            removeRaindrops();
            removeFireEffects();
            removeBonfire();
            removeCloudEffects();
            removeDisplayRain();
            removeThunderClouds();
            removeRainCardEffects();
            destroyRainFall();
            removeAcMist();
            removeFireflies();
        }

        // ==================== 篝火光照系统（Three.js shader 渲染） ====================
        let bonfireScene = null; // { renderer, scene, camera, mesh, uniforms, stopAnim }
        let bonfireRemoveTimer = null;
        let bonfirePendingScene = null;

        const BONFIRE_VERT = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position.xy, 0.0, 1.0);
            }
        `;

        const BONFIRE_FRAG = `
            precision highp float;
            varying vec2 vUv;
            uniform float uTime;
            uniform vec2  uResolution;
            uniform float uIntensity;
            uniform float uSize;
            uniform float uLight;
            uniform float uFlicker;
            uniform float uHeight;

            // ---- 噪声 ----
            float hash(vec3 p) {
                p = fract(p * vec3(0.1031, 0.1030, 0.0973));
                p += dot(p, p.yxz + 33.33);
                return fract((p.x + p.y) * p.z);
            }
            float noise(vec3 x) {
                vec3 i = floor(x); vec3 f = fract(x);
                f = f*f*f*(f*(f*6.0-15.0)+10.0);
                return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                           mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
            }
            const mat3 ROT = mat3(0.0,0.8,0.6,-0.8,0.36,-0.48,-0.6,-0.48,0.64);
            float fbm5(vec3 p) {
                float v=0.0, a=0.5;
                v += a*noise(p); p = ROT*p*2.03 + vec3(1.7,9.2,3.3); a*=0.5;
                v += a*noise(p); p = ROT*p*2.03 + vec3(8.3,2.8,5.1); a*=0.5;
                v += a*noise(p); p = ROT*p*2.03 + vec3(4.1,6.7,1.9); a*=0.5;
                v += a*noise(p); p = ROT*p*2.03 + vec3(2.4,7.5,8.2); a*=0.5;
                v += a*noise(p);
                return v;
            }

            void main() {
                vec2 uv = vUv;
                float aspect = uResolution.x / uResolution.y;
                vec2 p = vec2((uv.x - 0.5) * aspect, uv.y); // y: 0=底 1=顶

                // ---- 篝火位置（屏幕底部正中偏下） ----
                vec2 fireCenter = vec2(0.0, -0.05);

                // ---- 火焰形状 ----
                vec2 fp = p - fireCenter;
                float dist = length(fp);
                // 火焰锥形：越往上越窄
                float flameNarrow = 1.0 - smoothstep(0.0, 0.7, fp.y) * 0.55;
                // 火焰宽度随高度收窄（受 uSize 控制）
                float flameWidth = 0.35 * uSize * flameNarrow;
                float flameHeight = 0.55 * uHeight;

                // ---- 火焰噪声 ----
                float flowSpeed = uTime * 1.2;
                // 多层火焰
                vec3 nPos1 = vec3(fp.x * 4.0, fp.y * 3.0 - flowSpeed * 0.8, uTime * 0.3);
                float n1 = fbm5(nPos1);
                vec3 nPos2 = vec3(fp.x * 8.0, fp.y * 5.0 - flowSpeed * 1.2, uTime * 0.5);
                float n2 = fbm5(nPos2);
                vec3 nPos3 = vec3(fp.x * 2.0, fp.y * 2.0 - flowSpeed * 0.4, uTime * 0.15);
                float n3 = fbm5(nPos3);

                float flameNoise = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

                // 火焰形状遮罩
                float vertMask = smoothstep(flameHeight, 0.0, fp.y) * smoothstep(-0.05, 0.05, fp.y);
                float horizMask = smoothstep(flameWidth, flameWidth * 0.3, abs(fp.x));
                // 噪声扭曲火焰形状
                float distortedHoriz = smoothstep(flameWidth, flameWidth * 0.1, abs(fp.x - flameNoise * 0.08 + n2 * 0.04));
                float flameMask = vertMask * mix(horizMask, distortedHoriz, 0.7);
                // 火焰密度
                float flame = flameMask * (0.6 + flameNoise * 0.5);
                // 闪烁（受 uFlicker 控制）
                float flicker = 0.85 + 0.15 * uFlicker * sin(uTime * 7.3 * uFlicker + n1 * 6.0) * sin(uTime * 4.7 * uFlicker + n2 * 4.0);
                flame *= flicker;

                // ---- 火焰颜色（内焰白黄 → 外焰橙红） ----
                float innerDist = length(vec2(fp.x * 1.5, fp.y * 0.8));
                vec3 innerColor = vec3(1.0, 0.95, 0.75);   // 白黄
                vec3 midColor   = vec3(1.0, 0.6, 0.15);    // 橙色
                vec3 outerColor = vec3(0.8, 0.15, 0.02);   // 深红
                float colorGrad = smoothstep(0.0, 0.35, innerDist);
                vec3 flameColor = mix(innerColor, midColor, colorGrad);
                flameColor = mix(flameColor, outerColor, smoothstep(0.25, 0.55, innerDist));
                // 火焰尖端偏暗
                flameColor *= mix(1.0, 0.6, smoothstep(0.2, 0.45, fp.y));

                // ---- 光照效果（从底部向上照亮屏幕） ----
                // 篝火发出的光照范围
                float lightDist = length(p - fireCenter);
                // 光照衰减：从火源向上扩散，强度随距离衰减（大幅加大光照范围）
                float upwardBias = smoothstep(-0.15, 0.5, fp.y); // 主要照亮上方
                float lightFalloff = 1.0 / (1.0 + lightDist * 0.8);
                // 光照闪烁
                float lightFlicker = 0.9 + 0.1 * sin(uTime * 5.1 + n3 * 8.0)
                                    + 0.05 * sin(uTime * 8.7 + n1 * 5.0);
                // 光照颜色（暖橙色）
                vec3 lightColor = vec3(1.0, 0.6, 0.2);
                // 光照受上方偏移影响（受 uLight 控制）
                float lightSpread = lightFalloff * (0.3 + upwardBias * 0.7) * lightFlicker * uLight;
                // 光照噪声纹理（增加3D立体感）
                vec3 lightNoisePos = vec3(p * 3.0, uTime * 0.1);
                float lightNoiseVal = fbm5(lightNoisePos);
                lightSpread *= (0.85 + lightNoiseVal * 0.15);

                // ---- 余烬/火星 ----
                float embers = 0.0;
                for (int i = 0; i < 12; i++) {
                    float fi = float(i);
                    float seed = fi * 1.37 + 0.5;
                    float cycle = fract(uTime * (0.15 + seed * 0.08) + seed);
                    float ex = sin(seed * 7.3) * 0.15;
                    float ey = fireCenter.y + cycle * 0.7;
                    float exCur = ex + sin(uTime * 2.0 + fi * 3.0) * 0.05;
                    vec2 ePos = vec2(exCur, ey);
                    float eDist = length(p - ePos);
                    float eSize = 0.004 + 0.003 * sin(seed * 5.0);
                    float eAlpha = (1.0 - cycle) * smoothstep(eSize, 0.0, eDist);
                    embers += eAlpha;
                }

                // ---- 合成 ----
                vec3 col = vec3(0.0);
                // 火焰
                col += flameColor * flame * 2.0;
                // 光照（大幅增强）
                col += lightColor * lightSpread * 0.7;
                // 余烬
                col += vec3(1.0, 0.5, 0.1) * embers * 0.8;

                // 全局强度
                col *= uIntensity;

                // 半屏幕限制：上半部分逐渐衰减
                float topFade = 1.0 - smoothstep(0.4, 0.9, uv.y);
                col *= topFade;

                float alpha = (flame * 0.8 + lightSpread * 0.6 + embers * 0.3) * topFade;
                alpha = clamp(alpha, 0.0, 1.0);

                gl_FragColor = vec4(col, alpha);
            }
        `;

        function addBonfire() {
            if (bonfireScene) return;
            if (bonfireRemoveTimer) {
                clearTimeout(bonfireRemoveTimer);
                bonfireRemoveTimer = null;
            }
            if (bonfirePendingScene) {
                const old = bonfirePendingScene;
                bonfirePendingScene = null;
                if (old.stopAnim) old.stopAnim();
                if (old.onResize) window.removeEventListener('resize', old.onResize);
                old.renderer.dispose();
                old.mesh.geometry.dispose();
                old.mesh.material.dispose();
            }
            const canvas = document.getElementById('bonfireCanvas');
            if (!canvas) return;

            function init() {
                if (bonfireScene) return;
                if (typeof THREE === 'undefined') return;

                const SCALE = 0.75;
                const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
                renderer.setClearColor(0x000000, 0);
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
                const w = Math.max(1, Math.floor(window.innerWidth * SCALE));
                const h = Math.max(1, Math.floor(window.innerHeight * SCALE));
                renderer.setSize(w, h, false);

                const scene = new THREE.Scene();
                const camera = new THREE.Camera();

                const uniforms = {
                    uTime: { value: 0 },
                    uResolution: { value: new THREE.Vector2(w, h) },
                    uIntensity: { value: 1.0 },
                    uSize: { value: 1.0 },
                    uLight: { value: 1.0 },
                    uFlicker: { value: 1.0 },
                    uHeight: { value: 1.0 }
                };

                const material = new THREE.ShaderMaterial({
                    vertexShader: BONFIRE_VERT,
                    fragmentShader: BONFIRE_FRAG,
                    uniforms,
                    transparent: true,
                    depthWrite: false,
                    depthTest: false
                });

                const geometry = new THREE.PlaneGeometry(2, 2);
                const mesh = new THREE.Mesh(geometry, material);
                scene.add(mesh);

                bonfireScene = { renderer, scene, camera, mesh, uniforms, stopAnim: null, onResize: null };

                // 淡入
                canvas.classList.add('active');

                // 应用当前设置参数
                updateBonfireSettings();

                // 动画循环
                const startTime = performance.now();
                let animRunning = true;
                function animate() {
                    if (!animRunning) return;
                    uniforms.uTime.value = (performance.now() - startTime) / 1000;
                    renderer.render(scene, camera);
                    requestAnimationFrame(animate);
                }
                bonfireScene.stopAnim = () => { animRunning = false; };
                animate();

                // resize
                function onResize() {
                    if (!bonfireScene) return;
                    const nw = Math.max(1, Math.floor(window.innerWidth * SCALE));
                    const nh = Math.max(1, Math.floor(window.innerHeight * SCALE));
                    renderer.setSize(nw, nh, false);
                    uniforms.uResolution.value.set(nw, nh);
                }
                window.addEventListener('resize', onResize);
                bonfireScene.onResize = onResize;
            }

            if (typeof THREE === 'undefined') {
                loadThreeJS().then(init);
            } else {
                init();
            }
        }

        function removeBonfire() {
            if (!bonfireScene) return;
            const canvas = document.getElementById('bonfireCanvas');
            if (canvas) canvas.classList.remove('active');
            bonfirePendingScene = bonfireScene;
            bonfireScene = null;
            bonfireRemoveTimer = setTimeout(() => {
                bonfireRemoveTimer = null;
                const scene = bonfirePendingScene;
                bonfirePendingScene = null;
                if (!scene) return;
                if (scene.stopAnim) scene.stopAnim();
                if (scene.onResize) window.removeEventListener('resize', scene.onResize);
                scene.renderer.dispose();
                scene.mesh.geometry.dispose();
                scene.mesh.material.dispose();
            }, 1500);
        }

        // ==================== 萤火虫系统（Three.js shader 渲染） ====================
        let fireflyScene = null; // { renderer, scene, camera, mesh, uniforms, stopAnim, onResize }
        let fireflyRemoveTimer = null;
        let fireflyPendingScene = null;

        const FIREFLY_VERT = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position.xy, 0.0, 1.0);
            }
        `;

        const FIREFLY_FRAG = `
            precision highp float;
            varying vec2 vUv;
            uniform float uTime;
            uniform vec2  uResolution;
            uniform float uDensity;
            uniform float uSize;
            uniform float uGlow;
            uniform float uSpeed;
            uniform float uBlinkFreq;

            // 高质量哈希函数
            float hash(float n) {
                return fract(sin(n) * 43758.5453123);
            }
            float hash2(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            // 伪噪声用于更自然的运动
            float noise(float n) {
                float i = floor(n);
                float f = fract(n);
                f = f * f * (3.0 - 2.0 * f);
                return mix(hash(i), hash(i + 1.0), f);
            }

            void main() {
                vec2 uv = vUv;
                float aspect = uResolution.x / uResolution.y;
                vec2 coord = vec2(uv.x * aspect, uv.y);

                float totalBrightness = 0.0;
                vec3 totalColor = vec3(0.0);

                // 萤火虫数量（30-40 只）
                int count = int(35.0 * uDensity);
                count = max(count, 5);
                count = min(count, 80);

                for (int i = 0; i < 80; i++) {
                    if (i >= count) break;

                    float fi = float(i);

                    // 每只萤火虫独立的随机种子
                    float seed = fi * 1.618033988749 + 0.5;

                    // 基础位置（随机分布在屏幕上）
                    float baseX = hash(seed * 13.37) * aspect;
                    float baseY = hash(seed * 7.93 + 3.14) * 1.0;

                    // Lissajous 曲线运动：多频正弦叠加模拟随机漫游
                    float t = uTime * uSpeed * 0.3;
                    float freqX1 = 0.3 + hash(seed * 2.71) * 0.4;
                    float freqX2 = 0.7 + hash(seed * 3.14) * 0.5;
                    float freqY1 = 0.2 + hash(seed * 5.28) * 0.3;
                    float freqY2 = 0.5 + hash(seed * 1.62) * 0.6;
                    float phaseX1 = hash(seed * 11.11) * 6.2832;
                    float phaseX2 = hash(seed * 22.22) * 6.2832;
                    float phaseY1 = hash(seed * 33.33) * 6.2832;
                    float phaseY2 = hash(seed * 44.44) * 6.2832;

                    float ampX = 0.05 + hash(seed * 8.88) * 0.08;
                    float ampY = 0.04 + hash(seed * 9.99) * 0.07;

                    float dx = ampX * (sin(t * freqX1 + phaseX1) + 0.5 * sin(t * freqX2 + phaseX2));
                    float dy = ampY * (cos(t * freqY1 + phaseY1) + 0.5 * cos(t * freqY2 + phaseY2));

                    // 缓慢漂移（超低频分量）
                    float driftX = 0.03 * sin(t * 0.1 + hash(seed * 55.55) * 6.2832);
                    float driftY = 0.02 * cos(t * 0.08 + hash(seed * 66.66) * 6.2832);

                    vec2 pos = vec2(baseX + dx + driftX, baseY + dy + driftY);

                    // 萤火虫大小（略有差异）
                    float baseSize = 0.008 + hash(seed * 77.77) * 0.006;
                    float size = baseSize * uSize;

                    // 到萤火虫的距离
                    float dist = length(coord - pos);

                    // 闪烁效果：模拟真实萤火虫的间歇闪光
                    // 每只萤火虫有不同的闪烁频率和相位
                    float blinkSpeed = (0.15 + hash(seed * 88.88) * 0.25) * uBlinkFreq;
                    float phaseOffset = hash(seed * 99.99) * 6.2832;

                    // 闪烁周期：大部分时间暗淡，短暂闪亮后缓慢衰减
                    float blinkCycle = fract(uTime * blinkSpeed + phaseOffset);
                    // 上升沿快速（0.0~0.1），下降沿缓慢（0.1~0.4），之后暗淡
                    float blinkIntensity = smoothstep(0.0, 0.1, blinkCycle) * smoothstep(0.4, 0.15, blinkCycle);
                    // 微弱基础亮度
                    float baseGlow = 0.05;
                    float brightness = baseGlow + blinkIntensity * (1.0 - baseGlow);

                    // 径向高斯衰减光晕
                    float glow = exp(-dist * dist / (2.0 * size * size)) * uGlow;
                    // 核心更亮更小
                    float core = exp(-dist * dist / (2.0 * size * size * 0.15));

                    // 颜色：黄绿色核心（#aaff44 到 #88ff22），外围柔和光晕
                    vec3 coreColor = vec3(0.67, 1.0, 0.27); // #aaff44
                    vec3 glowColor = vec3(0.53, 1.0, 0.13); // #88ff22
                    vec3 outerGlow = vec3(0.4, 0.9, 0.1);   // 更外围的偏绿光晕

                    vec3 fireflyColor = coreColor * core * 1.5 + glowColor * glow * 0.8 + outerGlow * glow * 0.3;
                    fireflyColor *= brightness;

                    totalColor += fireflyColor;
                    totalBrightness += brightness * glow;
                }

                // 微弱环境光散射（模拟森林中萤火虫光的弥散效果）
                float ambientScatter = totalBrightness * 0.02;
                vec3 ambientColor = vec3(0.35, 0.7, 0.1) * ambientScatter;

                vec3 finalColor = totalColor + ambientColor;

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

        function addFireflies() {
            if (fireflyScene) return;
            if (fireflyRemoveTimer) {
                clearTimeout(fireflyRemoveTimer);
                fireflyRemoveTimer = null;
            }
            if (fireflyPendingScene) {
                const old = fireflyPendingScene;
                fireflyPendingScene = null;
                if (old.stopAnim) old.stopAnim();
                if (old.onResize) window.removeEventListener('resize', old.onResize);
                old.renderer.dispose();
                old.mesh.geometry.dispose();
                old.mesh.material.dispose();
            }
            const canvas = document.getElementById('fireflyCanvas');
            if (!canvas) return;

            function init() {
                if (fireflyScene) return;
                if (typeof THREE === 'undefined') return;

                const SCALE = 0.75;
                const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
                renderer.setClearColor(0x000000, 0);
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
                const w = Math.max(1, Math.floor(window.innerWidth * SCALE));
                const h = Math.max(1, Math.floor(window.innerHeight * SCALE));
                renderer.setSize(w, h, false);

                const scene = new THREE.Scene();
                const camera = new THREE.Camera();

                const uniforms = {
                    uTime: { value: 0 },
                    uResolution: { value: new THREE.Vector2(w, h) },
                    uDensity: { value: 1.0 },
                    uSize: { value: 1.0 },
                    uGlow: { value: 1.0 },
                    uSpeed: { value: 1.0 },
                    uBlinkFreq: { value: 1.0 }
                };

                const material = new THREE.ShaderMaterial({
                    vertexShader: FIREFLY_VERT,
                    fragmentShader: FIREFLY_FRAG,
                    uniforms,
                    transparent: true,
                    depthWrite: false,
                    depthTest: false
                });

                const geometry = new THREE.PlaneGeometry(2, 2);
                const mesh = new THREE.Mesh(geometry, material);
                scene.add(mesh);

                fireflyScene = { renderer, scene, camera, mesh, uniforms, stopAnim: null, onResize: null };

                // 淡入
                canvas.classList.add('active');

                // 应用当前设置参数
                updateFireflySettings();

                // 动画循环
                const startTime = performance.now();
                let animRunning = true;
                function animate() {
                    if (!animRunning) return;
                    uniforms.uTime.value = (performance.now() - startTime) / 1000;
                    renderer.render(scene, camera);
                    requestAnimationFrame(animate);
                }
                fireflyScene.stopAnim = () => { animRunning = false; };
                animate();

                // resize
                function onResize() {
                    if (!fireflyScene) return;
                    const nw = Math.max(1, Math.floor(window.innerWidth * SCALE));
                    const nh = Math.max(1, Math.floor(window.innerHeight * SCALE));
                    renderer.setSize(nw, nh, false);
                    uniforms.uResolution.value.set(nw, nh);
                }
                window.addEventListener('resize', onResize);
                fireflyScene.onResize = onResize;
            }

            if (typeof THREE === 'undefined') {
                loadThreeJS().then(init);
            } else {
                init();
            }
        }

        function removeFireflies() {
            if (!fireflyScene) return;
            const canvas = document.getElementById('fireflyCanvas');
            if (canvas) canvas.classList.remove('active');
            fireflyPendingScene = fireflyScene;
            fireflyScene = null;
            fireflyRemoveTimer = setTimeout(() => {
                fireflyRemoveTimer = null;
                const scene = fireflyPendingScene;
                fireflyPendingScene = null;
                if (!scene) return;
                if (scene.stopAnim) scene.stopAnim();
                if (scene.onResize) window.removeEventListener('resize', scene.onResize);
                scene.renderer.dispose();
                scene.mesh.geometry.dispose();
                scene.mesh.material.dispose();
            }, 1500);
        }

        function updateFireflySettings() {
            if (!fireflyScene) return;
            const settings = getSettings();
            const uniforms = fireflyScene.uniforms;
            uniforms.uDensity.value = settings.fireflyDensity / 100;
            uniforms.uSize.value = settings.fireflySize / 100;
            uniforms.uGlow.value = settings.fireflyGlow / 100;
            uniforms.uSpeed.value = settings.fireflySpeed / 100;
            uniforms.uBlinkFreq.value = settings.fireflyBlinkFreq / 100;
        }

        // ==================== 冷气白雾系统（Three.js shader 渲染） ====================
        let acMistScene = null; // { renderer, scene, camera, mesh, animId }

        const AC_MIST_VERT = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position.xy, 0.0, 1.0);
            }
        `;

        const AC_MIST_FRAG = `
            precision highp float;
            varying vec2 vUv;
            uniform float uTime;
            uniform vec2  uResolution;
            uniform float uIntensity;
            uniform float uSpeed;
            uniform float uSpread;
            uniform float uLength;
            uniform float uAngle; // -1~1，对应 -45°~+45°

            // 与雷雨云同源的噪声函数（改进版，减少噪点）
            float hash(vec3 p) {
                p = fract(p * vec3(0.1031, 0.1030, 0.0973));
                p += dot(p, p.yxz + 33.33);
                return fract((p.x + p.y) * p.z);
            }
            float noise(vec3 x) {
                vec3 i = floor(x); vec3 f = fract(x);
                f = f*f*f*(f*(f*6.0-15.0)+10.0);
                return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                           mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
            }
            const mat3 ROT = mat3(0.0,0.8,0.6,-0.8,0.36,-0.48,-0.6,-0.48,0.64);
            float fbm4(vec3 p) {
                float v=0.0, a=0.5;
                // 每层加入不同偏移，避免整数网格对齐产生直线接缝
                v += a * noise(p); p = ROT * p * 2.02 + vec3(1.7, 9.2, 3.3);
                a *= 0.5;
                v += a * noise(p); p = ROT * p * 2.02 + vec3(8.3, 2.8, 5.1);
                a *= 0.5;
                v += a * noise(p); p = ROT * p * 2.02 + vec3(4.1, 6.7, 1.9);
                a *= 0.5;
                v += a * noise(p);
                return v;
            }

            void main() {
                vec2 uv = vUv;
                // py: 0=顶部, 1=底部
                float py = 1.0 - uv.y;
                float px = uv.x - 0.5; // -0.5 ~ 0.5
                float aspect = uResolution.x / uResolution.y;
                px *= aspect;

                // 吹风角度：底部偏移最大，顶部为0（源头不变）
                float skew = py * uAngle * 0.8;
                px -= skew; // 倾斜坐标系，雾体和流动方向都向一侧偏

                // 1. 向下流动（减号=向下流；速度受 uSpeed 控制）
                // 加入 px 的微小偏移，打破水平采样对齐，消除带状直线
                float flow = py * 2.0 - uTime * 0.6 * uSpeed + px * 0.15;

                // 2. 扇形扩散：宽度受 uSpread 控制
                float halfWidth = (0.3 + py * 1.2) * uSpread;
                float horizontalMask = 1.0 - smoothstep(halfWidth * 0.5, halfWidth, abs(px));

                // 3. 从屏幕外进入，从屏幕外消失（不在屏幕内淡入淡出）
                float verticalMask = 1.0;

                // 4. 多层噪声叠加（增加立体体积感），长度受 uLength 控制
                // 每层噪声加入 px 的 sin 扰动，进一步打破水平对齐
                vec3 noisePos1 = vec3(px * 1.5 + sin(flow * 1.2) * 0.08, flow * uLength, uTime * 0.08);
                float n1 = fbm4(noisePos1);
                vec3 noisePos2 = vec3(px * 2.5 + cos(flow * 0.9 + 3.0) * 0.1, flow * 1.3 * uLength + 10.0, uTime * 0.12);
                float n2 = fbm4(noisePos2);
                vec3 noisePos3 = vec3(px * 0.8 + sin(flow * 0.6 + 7.0) * 0.06, flow * 0.7 * uLength - 5.0, uTime * 0.05);
                float n3 = fbm4(noisePos3);
                float mist = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

                // 5. 密度组合
                float density = mist * horizontalMask * verticalMask;

                // 6. 更柔和的平滑过渡，避免硬边产生直线痕迹
                density = smoothstep(0.08, 0.6, density);

                // 7. 最终透明度（限制最大值避免全白）
                float alpha = density * uIntensity;
                alpha = clamp(alpha, 0.0, 0.6);

                // 白雾颜色（偏冷的白色）
                vec3 mistColor = vec3(0.92, 0.95, 1.0);
                // 上方稍亮，下方稍暗
                mistColor *= mix(1.0, 0.8, py);

                gl_FragColor = vec4(mistColor, alpha);
            }
        `;

        // 空调开关机音效（播放 wav 文件，加时间戳防缓存）
        let _acSoundSrc = '音效/空调音效.wav?' + Date.now();
        function playAcSound() {
            try {
                const audio = new Audio(_acSoundSrc);
                audio.volume = 0.5;
                audio.play().catch(() => {});
            } catch (e) {
                console.warn('playAcSound failed:', e);
            }
        }

        // 冷气白雾鼠标追踪状态
        let acMistMouseX = 0.5;        // 鼠标归一化 x（0=左, 1=右）
        let acMistCurrentAngle = 0;     // 当前插值角度（度）
        let acMistMouseListener = null;
        let acMistRemoveTimer = null;  // 延迟销毁定时器
        let acMistPendingScene = null; // 延迟销毁中的旧场景引用

        // 实时更新冷气白雾参数
        function updateAcMistSettings() {
            if (!acMistScene) return;
            const settings = getSettings();
            acMistScene.uniforms.uIntensity.value = (settings.acMistIntensity / 100) * 0.8;
            acMistScene.uniforms.uSpeed.value = settings.acMistSpeed / 100;
            acMistScene.uniforms.uSpread.value = settings.acMistSpread / 100;
            acMistScene.uniforms.uLength.value = settings.acMistLength / 100;
            // uAngle 不再静态设置，由动画循环中的鼠标追踪动态更新
        }

        // 计算鼠标追踪的目标角度（基于鼠标 x 位置 + 设置中的角度限位）
        function getAcMistTargetAngle() {
            const settings = getSettings();
            const maxAngle = Math.abs(settings.acMistAngle); // 限位角度（0~45）
            // 鼠标在屏幕中心时角度=0，偏左为负，偏右为正
            const normalizedOffset = (acMistMouseX - 0.5) * 2; // -1~1
            const targetAngle = normalizedOffset * maxAngle;
            return targetAngle;
        }

        function addAcMist() {
            if (acMistScene) return;
            // 如果有延迟销毁中的旧场景，立即强制销毁
            if (acMistRemoveTimer) {
                clearTimeout(acMistRemoveTimer);
                acMistRemoveTimer = null;
            }
            if (acMistPendingScene) {
                const old = acMistPendingScene;
                acMistPendingScene = null;
                if (old.stopAnim) old.stopAnim();
                if (old.onResize) window.removeEventListener('resize', old.onResize);
                old.renderer.dispose();
                old.mesh.geometry.dispose();
                old.mesh.material.dispose();
            }

            const canvas = document.getElementById('acMistCanvas');
            if (!canvas) return;

            function init() {
                if (acMistScene) return;
                if (typeof THREE === 'undefined') return;

                const SCALE = 0.75; // 渲染分辨率比例
                const renderer = new THREE.WebGLRenderer({
                    canvas: canvas,
                    antialias: false,
                    alpha: true
                });
                renderer.setClearColor(0x000000, 0);
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
                const w = Math.max(1, Math.floor(window.innerWidth * SCALE));
                const h = Math.max(1, Math.floor(window.innerHeight * SCALE));
                renderer.setSize(w, h, false);

                const scene = new THREE.Scene();
                const camera = new THREE.Camera();

                const uniforms = {
                    uTime: { value: 0 },
                    uResolution: { value: new THREE.Vector2(w, h) },
                    uIntensity: { value: 0.8 },
                    uSpeed: { value: 1.0 },
                    uSpread: { value: 1.0 },
                    uLength: { value: 1.0 },
                    uAngle: { value: 0.0 }
                };

                const material = new THREE.ShaderMaterial({
                    vertexShader: AC_MIST_VERT,
                    fragmentShader: AC_MIST_FRAG,
                    uniforms: uniforms,
                    transparent: true,
                    depthWrite: false,
                    depthTest: false
                });

                const geometry = new THREE.PlaneGeometry(2, 2);
                const mesh = new THREE.Mesh(geometry, material);
                scene.add(mesh);

                acMistScene = { renderer, scene, camera, mesh, uniforms, stopAnim: () => { animRunning = false; } };

                // 淡入
                canvas.classList.add('active');

                // 播放空调开机音效
                playAcSound();

                // 动画循环（pending 期间也继续运行，保持雾运动直到 dispose）
                const startTime = performance.now();
                let animRunning = true;
                function animate() {
                    if (!animRunning) return;
                    const elapsed = (performance.now() - startTime) / 1000;
                    uniforms.uTime.value = elapsed;

                    // 鼠标追踪：lerp 插值，带滞后性和惯性（仅活跃场景时追踪）
                    if (acMistScene) {
                        const targetAngle = getAcMistTargetAngle();
                        acMistCurrentAngle += (targetAngle - acMistCurrentAngle) * 0.04;
                        uniforms.uAngle.value = acMistCurrentAngle / 45;
                    }

                    renderer.render(scene, camera);
                    requestAnimationFrame(animate);
                }
                animate();

                // 鼠标追踪监听
                acMistMouseX = 0.5;
                acMistCurrentAngle = 0;
                acMistMouseListener = function(e) {
                    acMistMouseX = e.clientX / window.innerWidth;
                };
                window.addEventListener('mousemove', acMistMouseListener);

                // resize
                function onResize() {
                    if (!acMistScene) return;
                    const nw = Math.max(1, Math.floor(window.innerWidth * SCALE));
                    const nh = Math.max(1, Math.floor(window.innerHeight * SCALE));
                    renderer.setSize(nw, nh, false);
                    uniforms.uResolution.value.set(nw, nh);
                }
                window.addEventListener('resize', onResize);
                acMistScene.onResize = onResize;

                // 应用保存的参数
                updateAcMistSettings();
            }

            if (typeof THREE === 'undefined') {
                loadThreeJS().then(init);
            } else {
                init();
            }
        }

        function removeAcMist() {
            if (!acMistScene) return;
            // 播放空调关机音效
            playAcSound();
            const canvas = document.getElementById('acMistCanvas');
            if (canvas) canvas.classList.remove('active');
            // 清理鼠标追踪监听
            if (acMistMouseListener) {
                window.removeEventListener('mousemove', acMistMouseListener);
                acMistMouseListener = null;
            }
            // 延迟销毁让淡出动画完成
            acMistPendingScene = acMistScene;
            acMistScene = null;
            acMistRemoveTimer = setTimeout(() => {
                acMistRemoveTimer = null;
                const scene = acMistPendingScene;
                acMistPendingScene = null;
                if (!scene) return;
                if (scene.stopAnim) scene.stopAnim();
                if (scene.onResize) window.removeEventListener('resize', scene.onResize);
                scene.renderer.dispose();
                scene.mesh.geometry.dispose();
                scene.mesh.material.dispose();
            }, 1500);
        }

        // ==================== 雷雨体积云系统（Three.js shader 渲染） ====================
        let thunderScenes = null; // { back, front, animId, lightningTimer }
        let thunderLoading = false;

        // --- 按需加载 Three.js ---
        function loadThreeJS() {
            return new Promise((resolve, reject) => {
                if (typeof THREE !== 'undefined') { resolve(); return; }
                if (thunderLoading) { reject('already loading'); return; }
                thunderLoading = true;
                const s = document.createElement('script');
                s.type = 'module';
                s.textContent = `
                    import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
                    window.THREE = THREE;
                    window.dispatchEvent(new Event('three-ready'));
                `;
                s.onerror = () => { thunderLoading = false; reject('load failed'); };
                document.head.appendChild(s);
                window.addEventListener('three-ready', () => {
                    thunderLoading = false;
                    resolve();
                }, { once: true });
            });
        }

        // --- 内联 shader：雷暴体积云（稀疏雷暴模式） ---
        const THUNDER_VERT = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position.xy, 0.0, 1.0);
            }
        `;

        // 后景：完整天空 + 云（不透明输出），稀疏云量
        const THUNDER_FRAG_BACK = `
            precision highp float;
            varying vec2 vUv;
            uniform vec2  uResolution;
            uniform float uTime;
            uniform vec3  uSunDirection;
            uniform vec3  uCameraPos;
            uniform mat4  uInvProjection;
            uniform mat4  uInvView;
            uniform float uThreshold;
            uniform float uSpeed;
            uniform float uBrightness;
            uniform float uThickness;
            uniform float uClustering;
            uniform float uCloudOpacity;

            // 改进的 hash 函数：使用大质数减少块状伪影
            float hash(vec3 p) {
                p = fract(p * vec3(0.1031, 0.1030, 0.0973));
                p += dot(p, p.yxz + 33.33);
                return fract((p.x + p.y) * p.z);
            }
            float noise(vec3 x) {
                vec3 i = floor(x); vec3 f = fract(x);
                // quintic smoothstep：消除二阶导数不连续，减少块状噪点
                f = f*f*f*(f*(f*6.0-15.0)+10.0);
                return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                           mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
            }
            const mat3 ROT = mat3(0.0,0.8,0.6,-0.8,0.36,-0.48,-0.6,-0.48,0.64);
            float fbm6(vec3 p) { float v=0.0,a=0.5; for(int i=0;i<6;i++){v+=a*noise(p);p=ROT*p*2.02;a*=0.5;} return v; }
            float fbm3(vec3 p) { float v=0.0,a=0.5; for(int i=0;i<3;i++){v+=a*noise(p);p=ROT*p*2.02;a*=0.5;} return v; }

            const vec3 VMIN = vec3(-150.0,-10.0,-150.0);
            const vec3 VMAX = vec3(150.0,52.0,150.0);
            vec3 drift() { return vec3(uTime*uSpeed*0.055,0.0,uTime*uSpeed*0.028); }
            vec3 driftDetail() { return vec3(uTime*uSpeed*0.18,0.0,uTime*uSpeed*0.09); }

            float getCloudHeight(vec3 p) {
                float thicknessScale = 1.0 + max(0.0, uThickness - 1.0) * 1.5;
                return ((p.y - VMIN.y) / (VMAX.y - VMIN.y)) / thicknessScale;
            }

            float highLayer(vec3 p, float h) {
                float topFade2 = 0.72 + min(uThickness, 1.0) * 0.28;
                float hg2 = smoothstep(0.55,0.72,h)*(1.0-smoothstep(topFade2,1.0,h));
                vec3 q = p*0.085+vec3(uTime*uSpeed*0.038,0.0,uTime*uSpeed*0.022);
                return max(fbm3(q)-0.52,0.0)*hg2*0.05;
            }

            // 后景：可调浓密雷暴云（参考项目 thunderstorm 模式）
            float densityFull(vec3 p) {
                float h = getCloudHeight(p);
                float topFadeStart = 0.30 + min(uThickness, 1.0) * 0.70;
                float hg = smoothstep(0.0,0.04,h)*(1.0-smoothstep(topFadeStart,1.0,h));
                vec3 q = p*0.052+drift();
                float d = fbm6(q)-uThreshold;
                d = max(d,0.0);
                // 团簇感低（雾）-> 小指数边缘柔和；团簇感高（云）-> 大指数边缘锐利
                float shapeExp = 0.6 + uClustering * 2.2;
                d = pow(d, shapeExp) * 2.4;
                d *= hg;
                d -= fbm3(p*0.42+driftDetail()+31.7)*0.10*smoothstep(0.0,0.25,h);
                d += highLayer(p,h);
                return max(d,0.0);
            }
            float densityLow(vec3 p) {
                float h = getCloudHeight(p);
                float topFadeStart = 0.30 + min(uThickness, 1.0) * 0.70;
                float hg = smoothstep(0.0,0.04,h)*(1.0-smoothstep(topFadeStart,1.0,h));
                vec3 q = p*0.052+drift();
                float d = fbm3(q)-uThreshold; d = max(d,0.0); d = d*d*2.4; d *= hg;
                return max(d,0.0);
            }

            vec2 rayBox(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) {
                vec3 inv=1.0/rd; vec3 t0=(bmin-ro)*inv; vec3 t1=(bmax-ro)*inv;
                vec3 ts=min(t0,t1); vec3 tb=max(t0,t1);
                return vec2(max(max(ts.x,ts.y),ts.z), min(min(tb.x,tb.y),tb.z));
            }
            float hgPhase(float ct, float g) { float g2=g*g; return (1.0-g2)/(4.0*3.14159265*pow(1.0+g2-2.0*g*ct,1.5)); }

            vec3 skyColor(vec3 rd, vec3 sunDir) {
                vec3 zen = vec3(0.10,0.12,0.18); vec3 hor = vec3(0.28,0.32,0.40);
                float t = clamp(rd.y*0.5+0.5,0.0,1.0);
                vec3 c = mix(hor,zen,smoothstep(0.0,1.0,t));
                c += vec3(1.0,0.92,0.78)*pow(max(dot(rd,sunDir),0.0),6.0)*0.22;
                c *= mix(0.50,1.0,smoothstep(-0.12,0.06,rd.y));
                return c;
            }
            float lightTrans(vec3 pos, vec3 sunDir) {
                float total=0.0; for(int i=0;i<5;i++){pos+=sunDir*5.0;total+=densityLow(pos)*5.0;} return exp(-total*0.7);
            }

            void main() {
                vec2 ndc = vUv*2.0-1.0;
                vec4 clip = vec4(ndc,-1.0,1.0);
                vec4 eye = uInvProjection*clip; eye = vec4(eye.xy,-1.0,0.0);
                vec3 rd = normalize((uInvView*eye).xyz);
                vec3 ro = uCameraPos;
                vec3 sunDir = normalize(uSunDirection);
                vec3 sky = skyColor(rd,sunDir);
                vec2 tHit = rayBox(ro,rd,VMIN,VMAX);
                vec3 col = sky;
                vec3 cloudCol = vec3(0.0);
                float trans = 1.0;
                if(tHit.y > max(tHit.x,0.0)) {
                    float tS = max(tHit.x,0.0), tE = tHit.y;
                    float step = (tE-tS)/48.0;
                    float jitter = fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233))+uTime*0.5)*43758.5453)*0.5;
                    float t = tS+step*jitter;
                    float cosT = dot(rd,sunDir);
                    float phase = hgPhase(cosT,0.6);
                    vec3 sunCol = vec3(0.70,0.74,0.84);
                    vec3 ambient = vec3(0.22,0.26,0.36);
                    vec3 scattered = vec3(0.0);
                    for(int i=0;i<48;i++){
                        if(t>tE||trans<0.01) break;
                        vec3 pos=ro+rd*t;
                        float d = densityFull(pos) * uCloudOpacity;
                        if(d>0.0){
                            float lt=lightTrans(pos,sunDir);
                            float silver=pow(max(cosT,0.0),8.0)*0.7;
                            vec3 rad=sunCol*lt*phase*16.0*(1.0+silver)+ambient*1.15;
                            float dT=exp(-1.2*d*step);
                            scattered+=trans*rad*d*step*dT;
                            trans*=dT;
                        }
                        t+=step;
                    }
                    // Storm cloud tint: slate grey at base, brighter crown
                    vec3 tint = mix(vec3(0.45,0.49,0.58), vec3(0.88,0.90,0.95),
                                    smoothstep(0.0,0.55,1.0-trans));
                    cloudCol = scattered*tint;
                    col = sky*trans + cloudCol;
                }
                // 对云颜色单独做后期处理，避免影响背景图
                vec3 processedCloud = cloudCol;
                processedCloud = processedCloud/(1.0+processedCloud);
                processedCloud = pow(processedCloud, vec3(1.0/2.2));
                processedCloud *= 1.0-dot(vUv-0.5,vUv-0.5)*0.45;
                processedCloud *= 0.85 * uBrightness;
                // alpha 由云的透射率决定：没有云时完全透明，露出背景图
                float cloudAlpha = 1.0 - trans;
                gl_FragColor = vec4(processedCloud, cloudAlpha);
            }
        `;

        function getThunderScale() {
            const q = getThunderUniforms().quality;
            if (q < 25) return 0.50;
            if (q < 55) return 0.65;
            if (q < 80) return 0.80;
            return 0.95;
        }

        let thunderFrontPuffTimer = null;

        function addThunderFrontClouds() {
            removeThunderFrontClouds();
            const container = document.getElementById('thunderCloudFront');
            if (!container) return;

            const cloudAmount = getSettings().thunderCloudAmount;
            // 云量 0 时完全不生成前景云
            if (cloudAmount <= 0) return;

            // 偶尔飘过：云量越高，飘过的频率越高，但始终稀疏
            const interval = 15000 + 45000 / Math.max(1, cloudAmount / 50);
            createThunderFrontPuff(container, 0);
            thunderFrontPuffTimer = setInterval(() => {
                if (!document.getElementById('thunderCloudFront')) return;
                const current = container.querySelectorAll('.thunder-front-puff').length;
                if (current < 2) createThunderFrontPuff(container, 0);
            }, interval);
        }

        function createThunderFrontPuff(container, delaySeconds) {
            const puff = document.createElement('div');
            puff.className = 'thunder-front-puff';
            const w = 320 + Math.random() * 380;
            const h = 130 + Math.random() * 140;
            const top = 12 + Math.random() * 58;
            const duration = 40 + Math.random() * 30;
            const scale = 0.8 + Math.random() * 0.35;

            // 前景云透明度跟随亮度：亮度越低越淡
            const brightness = (getSettings().thunderCloudBrightness || 100) / 100;
            const puffOpacity = Math.max(0.08, 0.32 * Math.min(1.2, brightness + 0.1));
            puff.style.setProperty('--puff-opacity', puffOpacity.toFixed(3));

            puff.style.width = w + 'px';
            puff.style.height = h + 'px';
            puff.style.top = top + '%';
            puff.style.left = '100vw';
            puff.style.animationDuration = `${duration}s, 0.25s`;
            puff.style.animationDelay = `-${delaySeconds}s, 0s`;
            puff.style.transform = `scale(${scale})`;

            container.appendChild(puff);

            // 动画结束后移除
            puff.addEventListener('animationend', (e) => {
                if (e.animationName === 'thunderPuffDrift' && puff.parentNode) {
                    puff.remove();
                }
            });
        }

        function removeThunderFrontClouds() {
            if (thunderFrontPuffTimer) {
                clearInterval(thunderFrontPuffTimer);
                thunderFrontPuffTimer = null;
            }
            const container = document.getElementById('thunderCloudFront');
            if (container) {
                container.querySelectorAll('.thunder-front-puff').forEach(p => {
                    p.style.transition = 'opacity 1.5s ease';
                    p.style.opacity = '0';
                    setTimeout(() => p.remove(), 1600);
                });
            }
        }

        function flashThunderFrontClouds() {
            const container = document.getElementById('thunderCloudFront');
            if (!container) return;
            container.querySelectorAll('.thunder-front-puff').forEach(p => {
                p.classList.add('flash');
                setTimeout(() => p.classList.remove('flash'), 260);
            });
        }

        function createThunderScene(canvasId) {
            const canvas = document.getElementById(canvasId);
            if (!canvas || typeof THREE === 'undefined') return null;

            const SCALE = getThunderScale();
            const renderer = new THREE.WebGLRenderer({
                canvas: canvas,
                antialias: false,
                alpha: true
            });
            renderer.setClearColor(0x000000, 0);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
            const w = Math.max(1, Math.floor(window.innerWidth * SCALE));
            const h = Math.max(1, Math.floor(window.innerHeight * SCALE));
            renderer.setSize(w, h, false);

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(58, window.innerWidth/window.innerHeight, 0.1, 1000);
            camera.position.set(0, 4.5, 12);
            camera.lookAt(0, 28, -42);
            camera.updateMatrixWorld();

            const invProj = new THREE.Matrix4().copy(camera.projectionMatrix).invert();
            const invView = new THREE.Matrix4().copy(camera.matrixWorld);

            const geo = new THREE.PlaneGeometry(2, 2);
            const u = getThunderUniforms();
            const s = getSettings();
            const uniforms = {
                uResolution: { value: new THREE.Vector2(w, h) },
                uTime: { value: 0 },
                uSunDirection: { value: new THREE.Vector3(0.35, 0.88, -0.32).normalize() },
                uCameraPos: { value: camera.position.clone() },
                uInvProjection: { value: invProj },
                uInvView: { value: invView },
                uThreshold: { value: u.threshold },
                uSpeed: { value: (s.thunderCloudSpeed || 100) / 100 },
                uBrightness: { value: (s.thunderCloudBrightness || 100) / 100 },
                uThickness: { value: (s.thunderCloudThickness || 50) / 100 },
                uClustering: { value: (s.thunderCloudClustering || 50) / 100 },
                uCloudOpacity: { value: (s.thunderCloudOpacity || 100) / 100 }
            };
            const mat = new THREE.ShaderMaterial({
                vertexShader: THUNDER_VERT,
                fragmentShader: THUNDER_FRAG_BACK,
                uniforms: uniforms,
                transparent: true,
                depthTest: false,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.frustumCulled = false;
            scene.add(mesh);

            return { renderer, scene, camera, uniforms, geo, mat, mesh, invProj, canvas };
        }

        async function addThunderClouds() {
            removeThunderCloudsImmediate();

            try {
                await loadThreeJS();
            } catch(e) {
                console.warn('Three.js 加载失败，无法渲染雷雨云', e);
                return;
            }

            // WebGL 后景云
            const scene = createThunderScene('thunderCloudBack');
            if (!scene) return;

            const clock = new THREE.Clock();
            let animId = null;

            function tick() {
                animId = requestAnimationFrame(tick);
                scene.uniforms.uTime.value = clock.getElapsedTime();
                scene.renderer.render(scene.scene, scene.camera);
            }
            tick();

            thunderScenes = { scene, animId, lightningTimer: null };

            // 入场动画：根据云量决定最终透明度，云量 0 时保持透明
            const backC = document.getElementById('thunderCloudBack');
            const fogOverlay = document.getElementById('thunderFogOverlay');
            if (fogOverlay) {
                fogOverlay.style.transition = 'opacity 1.2s ease';
                fogOverlay.style.opacity = String(Math.max(0, Math.min(100, getSettings().thunderCloudFog || 0)) / 100);
            }
            if (backC) {
                backC.classList.remove('fading-out');
                backC.classList.remove('active');
                backC.style.transition = 'opacity 1.2s ease';
                backC.style.opacity = '0';
                setTimeout(() => {
                    if (backC) backC.style.opacity = String(getThunderBackOpacity());
                }, 50);
            }

            // 启动闪电
            startThunderLightning();

            // 前景云：偶尔飘过，可遮挡所有组件
            addThunderFrontClouds();

            // 窗口 resize
            thunderScenes._onResize = () => {
                if (!thunderScenes || !thunderScenes.scene) return;
                const s = thunderScenes.scene;
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const SCALE = getThunderScale();
                s.camera.aspect = vw / vh;
                s.camera.updateProjectionMatrix();
                s.invProj.copy(s.camera.projectionMatrix).invert();
                s.uniforms.uInvProjection.value = s.invProj;
                s.uniforms.uResolution.value.set(Math.max(1, Math.floor(vw*SCALE)), Math.max(1, Math.floor(vh*SCALE)));
                s.renderer.setSize(Math.max(1, Math.floor(vw*SCALE)), Math.max(1, Math.floor(vh*SCALE)), false);
            };
            window.addEventListener('resize', thunderScenes._onResize);
        }

        function removeThunderClouds() {
            if (!thunderScenes) return;
            stopThunderLightning();
            const backC = document.getElementById('thunderCloudBack');
            const fogOverlay = document.getElementById('thunderFogOverlay');
            if (backC) {
                backC.classList.remove('active', 'fading-out');
                backC.style.transition = 'opacity 2.5s ease';
                backC.style.opacity = '0';
            }
            if (fogOverlay) {
                fogOverlay.style.transition = 'opacity 2.5s ease';
                fogOverlay.style.opacity = '0';
            }
            removeThunderFrontClouds();
            setTimeout(() => removeThunderCloudsImmediate(), 2800);
        }

        function removeThunderCloudsImmediate() {
            if (thunderScenes) {
                if (thunderScenes.animId) cancelAnimationFrame(thunderScenes.animId);
                thunderScenes.animId = null;
                if (thunderScenes._onResize) window.removeEventListener('resize', thunderScenes._onResize);

                try {
                    const s = thunderScenes.scene;
                    if (s) {
                        s.scene.remove(s.mesh);
                        s.geo.dispose();
                        s.mat.dispose();
                        s.renderer.dispose();
                    }
                } catch (e) {
                    console.warn('释放雷雨云资源时出错', e);
                }
                thunderScenes = null;
            }
            const backC = document.getElementById('thunderCloudBack');
            const fogOverlay = document.getElementById('thunderFogOverlay');
            if (backC) { backC.classList.remove('active','fading-out'); backC.style.opacity = '0'; backC.style.transition = ''; }
            if (fogOverlay) { fogOverlay.style.opacity = '0'; fogOverlay.style.transition = ''; }
            removeThunderFrontClouds();
        }

        function startThunderLightning() {
            stopThunderLightning();
            if (!thunderScenes) return;
            const freq = getSettings().thunderLightningFreq;
            if (freq <= 0) return;
            const scheduleNext = () => {
                if (!thunderScenes) return;
                const f = Math.max(1, Math.min(200, freq));
                let minDelay, maxDelay;
                if (f <= 100) {
                    minDelay = Math.max(1.0, 10.0 - f * 0.09);
                    maxDelay = Math.max(3.0, 25.0 - f * 0.22);
                } else {
                    minDelay = Math.max(0.3, 1.0 - (f - 100) * 0.007);
                    maxDelay = Math.max(1.0, 3.0 - (f - 100) * 0.02);
                }
                const delay = (minDelay + Math.random() * (maxDelay - minDelay)) * 1000;
                thunderScenes.lightningTimer = setTimeout(() => {
                    triggerThunderLightning();
                    scheduleNext();
                }, delay);
            };
            scheduleNext();
        }

        function stopThunderLightning() {
            if (thunderScenes && thunderScenes.lightningTimer) {
                clearTimeout(thunderScenes.lightningTimer);
                thunderScenes.lightningTimer = null;
            }
        }

        function triggerThunderLightning() {
            const overlay = document.getElementById('lightningFlashOverlay');
            if (!overlay || !thunderScenes) return;

            // 双闪
            overlay.classList.add('flash');
            flashThunderFrontClouds();
            setTimeout(() => overlay.classList.remove('flash'), 80);
            setTimeout(() => {
                overlay.classList.add('flash');
                flashThunderFrontClouds();
                setTimeout(() => overlay.classList.remove('flash'), 120);
            }, 150);
        }

        let audioFadeRAF = null;
        let audioTargetVolume = 0.5;
        let audioFadingOut = false;
        const AUDIO_FADE_DURATION = 2000;

        function fadeAudioTo(target, duration, callback) {
            const audio = document.getElementById('bgMusic');
            cancelAnimationFrame(audioFadeRAF);
            const start = audio.volume;
            const startTime = performance.now();
            function step(now) {
                const t = Math.min(1, (now - startTime) / duration);
                audio.volume = Math.max(0, Math.min(1, start + (target - start) * t));
                if (t < 1) {
                    audioFadeRAF = requestAnimationFrame(step);
                } else if (callback) {
                    callback();
                }
            }
            audioFadeRAF = requestAnimationFrame(step);
        }

        function fadeAudioIn() {
            audioFadingOut = false;
            fadeAudioTo(audioTargetVolume, 1500);
        }

        function fadeAudioOut(callback) {
            audioFadingOut = true;
            fadeAudioTo(0, 1200, callback);
        }

        function initAudioFadeLoop() {
            const audio = document.getElementById('bgMusic');
            audio.addEventListener('timeupdate', () => {
                if (!audio.duration || audio.paused) return;
                if (audio.duration - audio.currentTime < AUDIO_FADE_DURATION / 1000 && !audioFadingOut) {
                    audioFadingOut = true;
                    fadeAudioTo(0, AUDIO_FADE_DURATION);
                }
            });
            audio.addEventListener('ended', () => {
                audio.currentTime = 0;
                audioFadingOut = false;
                audio.play().then(() => {
                    fadeAudioTo(audioTargetVolume, AUDIO_FADE_DURATION);
                }).catch(() => {});
            });
        }

        function restoreSound() {
            const saved = localStorage.getItem('currentSoundIndex');
            const idx = saved !== null ? parseInt(saved) : -1;
            if (idx >= 0 && idx < soundFiles.length) {
                currentSoundIndex = idx;
                const audio = document.getElementById('bgMusic');
                audio.src = `音效/${soundFiles[idx].file}`;
                audio.volume = 0;
                audio.play().then(() => {
                    fadeAudioIn();
                }).catch(() => {});
                applySoundButtonStyle(idx);
            }
        }

        function selectSound(index) {
            const bgMusic = document.getElementById('bgMusic');

            if (currentSoundIndex === index) {
                fadeAudioOut(() => {
                    bgMusic.pause();
                    bgMusic.currentTime = 0;
                });
                currentSoundIndex = -1;
                localStorage.setItem('currentSoundIndex', '-1');
                clearSoundButtonStyle();
            } else {
                // 先清理上一个音效的视觉特效
                clearSoundButtonStyle();
                currentSoundIndex = index;
                localStorage.setItem('currentSoundIndex', String(index));
                bgMusic.src = `音效/${soundFiles[index].file}`;
                bgMusic.volume = 0;
                bgMusic.play().catch(err => {
                    alert('无法播放音频，请检查文件路径');
                });
                fadeAudioIn();
                applySoundButtonStyle(index);
            }

            showSoundModal();
        }

        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    alert('全屏模式不可用');
                });
                document.getElementById('fullscreenBtn').style.display = 'none';
                document.getElementById('exitFullscreenBtn').style.display = 'flex';
            } else {
                document.exitFullscreen();
                document.getElementById('fullscreenBtn').style.display = 'flex';
                document.getElementById('exitFullscreenBtn').style.display = 'none';
            }
        }

        document.addEventListener('fullscreenchange', function() {
            if (!document.fullscreenElement) {
                document.getElementById('fullscreenBtn').style.display = 'flex';
                document.getElementById('exitFullscreenBtn').style.display = 'none';
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // 标签页隐藏时：暂停视差动画循环，防止 idleCheckTimer 在后台累积
                if (idleCheckTimer) { clearInterval(idleCheckTimer); idleCheckTimer = null; }
                scheduledFrame = false; // 阻止下一帧调度
            } else {
                // 标签页恢复时：重置 idleTime 避免累积导致的跳变，重新启动视差
                idleTime = 0;
                idleModeActive = false;
                if (isStudying) {
                    requestWakeLock();
                    const wakeAudio = document.getElementById('wakeAudio');
                    if (wakeAudio && wakeAudio.paused) {
                        wakeAudio.play().catch(() => {});
                    }
                    if (wakeAudioContext && wakeAudioContext.state === 'suspended') {
                        wakeAudioContext.resume().catch(() => {});
                    }
                }
                scheduleParallaxFrame();
            }
        });

        document.getElementById('timeInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                startStudyWithTime();
            }
        });

        window.onclick = function(event) {
            if (event.target.classList.contains('modal')) {
                closeModal(event.target.id);
            }
        };

        setInterval(updateCurrentTime, 1000);
        updateCurrentTime();
        loadRecords();
        loadStudyState();
        loadVolumeOnStart();
        loadSettings();
        applyTheme(getSettings().theme || 'rounded', false);
        initWallpaperDB(); // 异步：迁移旧数据 + 应用当前壁纸
        initAudioFadeLoop();
        restoreSound();

        // 渲染自习类型按钮
        renderStudyTypeButtons();

        // 自习类型选择（事件委托）
        document.getElementById('studyTypeButtons').addEventListener('click', e => {
            const deleteBadge = e.target.closest('.study-type-delete-badge');
            if (deleteBadge) {
                const type = deleteBadge.dataset.type;
                deleteStudyType(type);
                const container = document.getElementById('studyTypeButtons');
                if (container.dataset.activeType === type) {
                    container.dataset.activeType = '';
                }
                renderStudyTypeButtons();
                return;
            }

            const btn = e.target.closest('.study-type-btn');
            if (!btn) return;
            const container = document.getElementById('studyTypeButtons');
            const input = document.getElementById('studyTypeInput');

            if (btn.id === 'studyTypeManageBtn') {
                toggleManageMode();
                return;
            }

            if (isDraggingType || justDraggedType) return;

            container.querySelectorAll('.study-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            container.dataset.activeType = btn.dataset.type;

            if (btn.dataset.type === 'other') {
                input.style.display = 'block';
                input.focus();
            } else {
                input.style.display = 'none';
                input.value = '';
            }
        });

        // 自习类型拖拽排序
        initStudyTypeDragSort();

        // 课间休息时长选项
        document.querySelectorAll('.break-option-btn[data-min]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.break-option-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                startBreakCountdown(parseInt(btn.dataset.min));
            });
        });
        document.getElementById('breakCustomBtn').addEventListener('click', () => {
            const input = document.getElementById('breakCustomInput');
            const minutes = parseFloat(input.value);
            if (minutes && minutes > 0 && minutes <= 120) {
                document.querySelectorAll('.break-option-btn').forEach(b => b.classList.remove('active'));
                startBreakCountdown(minutes);
            } else {
                input.style.borderColor = 'rgba(239, 68, 68, 0.7)';
                setTimeout(() => input.style.borderColor = 'rgba(255, 255, 255, 0.2)', 800);
            }
        });
        document.getElementById('breakCustomInput').addEventListener('keypress', e => {
            if (e.key === 'Enter') document.getElementById('breakCustomBtn').click();
        });

        const parallaxContainer = document.getElementById('parallaxContainer');
        const parallaxBg = document.querySelector('.parallax-bg');
        const studyBg = document.getElementById('studyBg');
        const bgOverlay = document.getElementById('bgOverlay');

        const layers = [
            { element: parallaxBg, offsetX: 6, offsetY: 3 },
            { element: studyBg, offsetX: 6, offsetY: 3 },
            { element: bgOverlay, offsetX: 6, offsetY: 3 },
            { element: document.querySelector('#fullscreenBtn'), offsetX: 7, offsetY: 4 },
            { element: document.querySelector('#exitFullscreenBtn'), offsetX: 7, offsetY: 4 },
            { element: document.querySelector('.current-time'), offsetX: 8, offsetY: 5 },
            { element: document.querySelector('#stopBtn'), offsetX: 10, offsetY: 6 },
            { element: document.querySelector('#breakBtn'), offsetX: 10, offsetY: 6 },
            { element: document.querySelector('#soundBtn'), offsetX: 12, offsetY: 8 },
            { element: document.querySelector('#settingsBtn'), offsetX: 14, offsetY: 10 },
            { element: document.querySelector('.main-container'), offsetX: 16, offsetY: 12 },
            { element: document.querySelector('.study-display'), offsetX: 18, offsetY: 14 },
            { element: document.querySelector('.modal'), offsetX: 20, offsetY: 15 },
            { element: document.querySelector('.glass-orb-1'), offsetX: 26, offsetY: 18 },
            { element: document.querySelector('.glass-orb-2'), offsetX: 28, offsetY: 19 },
            { element: document.querySelector('.glass-orb-3'), offsetX: 30, offsetY: 20 },
            { element: document.querySelector('.glass-orb-4'), offsetX: 32, offsetY: 21 }
        ];

        let targetX = 0;
        let targetY = 0;
        let currentX = 0;
        let currentY = 0;
        const lerpFactor = 0.12;
        let scheduledFrame = false;
        let idleTime = 0;
        let floatAngle = 0;
        let idleModeActive = false;
        let idleCheckTimer = null; // 用于在动画停止后继续累积 idleTime
        const glassOrbRotations = { 'glass-orb-1': 0, 'glass-orb-2': 0, 'glass-orb-3': 0, 'glass-orb-4': 0 };
        const glassOrbSpeeds = { 'glass-orb-1': 0.04, 'glass-orb-2': 0.07, 'glass-orb-3': 0.11, 'glass-orb-4': 0.15 };
        let isSquareTheme = document.body.classList.contains('theme-square');

        // 监听主题变化
        const themeObserver = new MutationObserver(() => {
            isSquareTheme = document.body.classList.contains('theme-square');
        });
        themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        function scheduleParallaxFrame() {
            if (!scheduledFrame) {
                scheduledFrame = true;
                requestAnimationFrame(renderParallax);
            }
        }

        document.addEventListener('pointermove', (e) => {
            const rect = document.documentElement.getBoundingClientRect();
            const centerX = e.clientX - rect.width / 2;
            const centerY = e.clientY - rect.height / 2;
            targetX = centerX / (rect.width / 2);
            targetY = centerY / (rect.height / 2);
            idleTime = 0;
            idleModeActive = false;
            if (idleCheckTimer) { clearInterval(idleCheckTimer); idleCheckTimer = null; }
            scheduleParallaxFrame();
        });

        document.addEventListener('mouseleave', () => {
            targetX = 0;
            targetY = 0;
            idleTime = 0;
            idleModeActive = false;
            if (idleCheckTimer) { clearInterval(idleCheckTimer); idleCheckTimer = null; }
            scheduleParallaxFrame();
        });

        function renderParallax() {
            scheduledFrame = false;

            idleTime++;

            let needContinue = false;

            if (idleTime > 120) {
                idleModeActive = true;
                const intensity = Math.min((idleTime - 120) / 300, 1);
                floatAngle += 0.008;
                const floatX = Math.sin(floatAngle * 1.3) * 3 * intensity;
                const floatY = Math.cos(floatAngle * 0.9) * 2 * intensity;
                targetX = floatX;
                targetY = floatY;

                const floatX1 = Math.sin(floatAngle * 0.5) * 4 * intensity;
                const floatY1 = Math.cos(floatAngle * 0.6) * 2.5 * intensity;
                const floatX2 = Math.sin(floatAngle * 1.8) * 2 * intensity;
                const floatY2 = Math.cos(floatAngle * 0.4) * 3.5 * intensity;
                const floatX3 = Math.sin(floatAngle * 1.2) * 3 * intensity;
                const floatY3 = Math.cos(floatAngle * 0.8) * 2 * intensity;
                const floatX4 = Math.sin(floatAngle * 0.7) * 3.5 * intensity;
                const floatY4 = Math.cos(floatAngle * 1.1) * 2.8 * intensity;

                if (layers[11]) { layers[11].floatX = floatX1; layers[11].floatY = floatY1; }
                if (layers[12]) { layers[12].floatX = floatX2; layers[12].floatY = floatY2; }
                if (layers[13]) { layers[13].floatX = floatX3; layers[13].floatY = floatY3; }
                if (layers[14]) { layers[14].floatX = floatX4; layers[14].floatY = floatY4; }
                needContinue = true; // idle浮动需要持续动画
            } else {
                for (const layer of layers) {
                    layer.floatX = 0;
                    layer.floatY = 0;
                }
            }

            currentX += (targetX - currentX) * lerpFactor;
            currentY += (targetY - currentY) * lerpFactor;

            // 如果还没收敛到目标，需要继续渲染
            if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
                needContinue = true;
            } else {
                currentX = targetX;
                currentY = targetY;
            }

            for (const layer of layers) {
                if (layer.element) {
                    let moveX = currentX * layer.offsetX;
                    let moveY = currentY * layer.offsetY;
                    if (layer.floatX !== undefined) moveX += layer.floatX;
                    if (layer.floatY !== undefined) moveY += layer.floatY;
                    const isGlassOrb = layer.element.classList && layer.element.classList.contains('glass-orb');
                    if (isSquareTheme && isGlassOrb) {
                        const orbClass = Object.keys(glassOrbSpeeds).find(cls => layer.element.classList.contains(cls));
                        let rotation = 0;
                        if (orbClass) {
                            glassOrbRotations[orbClass] += glassOrbSpeeds[orbClass];
                            if (glassOrbRotations[orbClass] >= 360) glassOrbRotations[orbClass] %= 360;
                            rotation = glassOrbRotations[orbClass];
                        }
                        layer.element.style.transform = `translate(${moveX}px, ${moveY}px) rotate(${rotation}deg)`;
                    } else {
                        layer.element.style.transform = `translate(${moveX}px, ${moveY}px)`;
                    }
                }
            }

            // 方正主题的glass-orb旋转需要持续动画
            if (isSquareTheme) {
                needContinue = true;
            }

            if (needContinue) {
                scheduleParallaxFrame();
            } else if (idleTime < 120 && !idleCheckTimer) {
                // 动画已收敛但 idleTime 未达到浮动阈值，启动低频定时器继续累积
                idleCheckTimer = setInterval(() => {
                    idleTime += 6; // 每100ms约增加6帧的idleTime
                    if (idleTime >= 120) {
                        clearInterval(idleCheckTimer);
                        idleCheckTimer = null;
                        scheduleParallaxFrame(); // 开始浮动动画
                    }
                }, 100);
            }
        }

        // 页面加载时启动视差循环
        scheduleParallaxFrame();
