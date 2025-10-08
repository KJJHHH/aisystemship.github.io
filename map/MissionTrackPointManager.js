(function(){
    let missionCounter = 3; // 任務ID計數器

    // 統一的任務-軌跡點數據管理器
    class MissionTrackPointManager {
        constructor() {
            this.missions = new Map();           // 派遣任務
            this.trackPoints = new Map();        // 軌跡點
            this.missionTrackLinks = new Map();  // 任務與軌跡點的關聯
            this.initializeDefaultData();
        }

        // 安全獲取船舶ID的輔助方法
        getVesselIdString(point) {
            // 如果全局的 safePointHelpers 可用，使用它
            if (typeof window !== 'undefined' && window.safePointHelpers && window.safePointHelpers.getVesselIdString) {
                return window.safePointHelpers.getVesselIdString(point);
            }
            
            // 否則使用本地實現
            try {
                const tp = (point && point.data) || point || {};
                const id = tp.vesselId || tp.vessel_id || tp.mmsi || tp.imo || 'UNKNOWN';
                return id == null ? 'UNKNOWN' : String(id);
            } catch (error) {
                console.warn('Error getting vessel ID:', error);
                return 'UNKNOWN';
            }
        }

        // 創建或更新派遣任務
        createMission(missionData) {
            // Support either passing a sourceTrackPoint object or a stable sourceTrackPointId.
            // Normalize to the safe point id for comparison so that missions reuse works
            // even when the point object is re-created during event re-initialization.
            const incomingSourceObj = missionData.sourceTrackPoint || null;
            const incomingSourceIdField = missionData.sourceTrackPointId || null;
            const incomingSourceId = incomingSourceIdField || (incomingSourceObj ? getSafePointId(incomingSourceObj) : null);

            if (incomingSourceId) {
                for (const [mid, m] of this.missions.entries()) {
                    const existingSourceId = (m.sourceTrackPointId) || (m.sourceTrackPoint ? getSafePointId(m.sourceTrackPoint) : null);
                    if (existingSourceId && existingSourceId === incomingSourceId && m.action === missionData.action && m.type === missionData.type && (m.isScheduled === missionData.isScheduled)) {
                        // update existing mission with latest metadata and return existing id
                        const updated = { ...m, ...missionData, missionId: mid, timestamp: missionData.timestamp || m.timestamp || new Date().toISOString(), sourceTrackPointId: incomingSourceId };
                        // ensure we store a normalized sourceTrackPointId for stable future comparisons
                        delete updated.sourceTrackPoint; // avoid storing object identity
                        this.missions.set(mid, updated);
                        console.log('Reused existing mission for sourceTrackPointId:', mid, incomingSourceId);
                        // ensure linkage
                        if (updated.boundPointId) this.autoLinkTrackPoints(mid);
                        return mid;
                    }
                }
            }

            const missionId = missionData.missionId || `MISSION-${++missionCounter}`;
            const mission = {
                ...missionData,
                missionId: missionId,
                timestamp: missionData.timestamp || new Date().toISOString(),
                // prefer storing a stable sourceTrackPointId rather than object identity
                sourceTrackPointId: incomingSourceId || missionData.sourceTrackPointId || null,
                // one-to-one binding: store a single bound track point id
                boundPointId: Array.isArray(missionData.boundPointId) ? (missionData.boundPointId[0] || null) : (missionData.boundPointId || null)
            };

            this.missions.set(missionId, mission);
            console.log('Mission created in manager:', mission);

            // 自動關聯相近時間的軌跡點
            this.autoLinkTrackPoints(missionId);

            return missionId;
        }

        // 創建或更新軌跡點
        createTrackPoint(pointData) {
            // Normalize incoming point into canonical shape if helper exists
            let normalized = pointData;
            try {
                // 使用 safePointHelpers 對象，更安全
                if (typeof window !== 'undefined' && window.safePointHelpers && window.safePointHelpers.createCanonicalPoint) {
                    normalized = window.safePointHelpers.createCanonicalPoint(pointData, { legacy: true });
                } else if (pointData && !pointData.pointId) {
                    normalized = Object.assign({}, pointData, { pointId: pointData.id || `TRACK-${Date.now()}-${Math.random().toString(16).substr(2,6)}` });
                }
            } catch (err) { console.warn('Normalization failed, using original pointData', err); normalized = pointData; }

            const pointId = normalized.pointId || normalized.id || `TRACK-${Date.now()}-${Math.random().toString(16).substr(2, 6)}`;
            const trackPoint = {
                ...normalized,
                pointId: pointId,
                // normalize legacy array -> single id for boundMissionId
                boundMissionId: Array.isArray(normalized.boundMissionId) ? (normalized.boundMissionId[0] || null) : (normalized.boundMissionId || null)
            };

            this.trackPoints.set(pointId, trackPoint);

            // 自動關聯相近時間的派遣任務
            this.autoLinkMissions(pointId);

            return pointId;
        }

        // 强制建立一對一綁定（missionId <-> pointId）
        bindMissionToPoint(missionId, pointId) {
            const mission = this.missions.get(missionId);
            const point = this.trackPoints.get(pointId);
            if (!mission || !point) return false;

            // If either side already bound to someone else, unbind them first
            if (mission.boundPointId && mission.boundPointId !== pointId) {
                const prevPoint = this.trackPoints.get(mission.boundPointId);
                if (prevPoint) prevPoint.boundMissionId = null;
                this.missionTrackLinks.delete(`${missionId}-${mission.boundPointId}`);
            }
            if (point.boundMissionId && point.boundMissionId !== missionId) {
                const prevMission = this.missions.get(point.boundMissionId);
                if (prevMission) prevMission.boundPointId = null;
                this.missionTrackLinks.delete(`${point.boundMissionId}-${pointId}`);
            }

            mission.boundPointId = pointId;
            point.boundMissionId = missionId;

            // create/update link record
            const linkKey = `${missionId}-${pointId}`;
            this.missionTrackLinks.set(linkKey, {
                missionId, pointId, linkTime: new Date().toISOString(), linkReason: 'explicit_bind'
            });
            return true;
        }

        // 解除單一綁定（missionId 或 pointId 任一存在）
        unbindMissionFromPoint(missionId, pointId) {
            const mission = this.missions.get(missionId);
            const point = this.trackPoints.get(pointId);
            if (mission && mission.boundPointId === pointId) mission.boundPointId = null;
            if (point && point.boundMissionId === missionId) point.boundMissionId = null;
            this.missionTrackLinks.delete(`${missionId}-${pointId}`);
            return true;
        }

        // 公開便利操作
        unbindMission(missionId) { if (!missionId) return false; const mission = this.missions.get(missionId); if (!mission || !mission.boundPointId) return false; return this.unbindMissionFromPoint(missionId, mission.boundPointId); }
        unbindPoint(pointId) { if (!pointId) return false; const point = this.trackPoints.get(pointId); if (!point || !point.boundMissionId) return false; return this.unbindMissionFromPoint(point.boundMissionId, pointId); }

        // 自動關聯軌跡點到任務 (基於時間和位置)
        autoLinkTrackPoints(missionId) {
            const mission = this.missions.get(missionId);
            if (!mission) return;

            const missionTime = new Date(mission.timestamp);
            let linkedCount = 0;

            this.trackPoints.forEach((point, pointId) => {
                const pointTime = new Date(point.timestamp);
                const timeDiff = Math.abs(pointTime - missionTime);

                // 動態時間窗口：根據任務類型調整
                let timeWindow;
                if (mission.action === 'track') {
                    timeWindow = 4 * 60 * 60 * 1000; // 持續追蹤：4小時窗口
                } else if (mission.action === 'uav' || mission.action === 'satellite') {
                    timeWindow = 1 * 60 * 60 * 1000; // UAV/衛星：1小時窗口
                } else {
                    timeWindow = 2 * 60 * 60 * 1000; // 默認：2小時窗口
                }

                // 時間窗口內 + 船舶ID匹配
                const pointVesselId = this.getVesselIdString(point);
                const vesselIdMatch = mission.targetVesselId === pointVesselId ||
                                    mission.targetVesselId === 'all' ||
                                    (mission.targetInfo && mission.targetInfo.includes(pointVesselId));

                if (timeDiff <= timeWindow && vesselIdMatch) {

                    // Enforce one-to-one binding: skip if the point is already bound to another mission
                    if (point.boundMissionId && point.boundMissionId !== missionId) {
                        return; // point already owned
                    }
                    // Also skip if mission already bound to a different point
                    if (mission.boundPointId && mission.boundPointId !== pointId) {
                        return; // mission already has a bound point
                    }

                    // Establish one-to-one binding
                    mission.boundPointId = pointId;
                    point.boundMissionId = missionId;

                    // 計算關聯強度分數
                    const timeScore = Math.max(0, 1 - (timeDiff / timeWindow)); // 時間越近分數越高
                    const taskTypeScore = point.hasTask ? 0.3 : 0; // 有任務的軌跡點分數更高
                    const typeScore = point.type === 'Future' && mission.isScheduled ? 0.5 :
                                    point.type === 'Current' ? 0.8 : 0.2;

                    const linkScore = (timeScore * 0.5) + taskTypeScore + (typeScore * 0.2);

                    // 建立關聯記錄 (one-to-one)
                    this.missionTrackLinks.set(`${missionId}-${pointId}`, {
                        missionId: missionId,
                        pointId: pointId,
                        linkTime: new Date().toISOString(),
                        linkReason: 'auto_time_vessel',
                        timeDifference: timeDiff,
                        linkScore: linkScore,
                        timeWindow: timeWindow
                    });

                    linkedCount++;
                }
            });

            console.log(`Mission ${missionId} linked to ${linkedCount} track points`);
            return linkedCount;
        }

        // 自動關聯派遣任務到軌跡點
        autoLinkMissions(pointId) {
            const point = this.trackPoints.get(pointId);
            if (!point) return;

            const pointTime = new Date(point.timestamp);
            let linkedCount = 0;

            this.missions.forEach((mission, missionId) => {
                // If mission explicitly references this point by id, bind immediately (highest priority)
                if (mission.sourceTrackPointId && mission.sourceTrackPointId === pointId) {
                    // enforce one-to-one binding semantics
                    if (!point.boundMissionId || point.boundMissionId === missionId) {
                        point.boundMissionId = missionId;
                        mission.boundPointId = pointId;
                        const linkKey = `${missionId}-${pointId}`;
                        this.missionTrackLinks.set(linkKey, {
                            missionId: missionId,
                            pointId: pointId,
                            linkTime: new Date().toISOString(),
                            linkReason: 'explicit_source_match'
                        });
                        linkedCount++;
                        return; // continue to next mission
                    }
                }
                const missionTime = new Date(mission.timestamp);
                const timeDiff = Math.abs(pointTime - missionTime);

                // 動態時間窗口：根據任務類型調整
                let timeWindow;
                if (mission.action === 'track') {
                    timeWindow = 4 * 60 * 60 * 1000; // 持續追蹤：4小時窗口
                } else if (mission.action === 'uav' || mission.action === 'satellite') {
                    timeWindow = 1 * 60 * 60 * 1000; // UAV/衛星：1小時窗口
                } else {
                    timeWindow = 2 * 60 * 60 * 1000; // 默認：2小時窗口
                }

                // 時間窗口內 + 船舶ID匹配
                const pointVesselId = this.getVesselIdString(point);
                const vesselIdMatch = mission.targetVesselId === pointVesselId ||
                                    mission.targetVesselId === 'all' ||
                                    (mission.targetInfo && mission.targetInfo.includes(pointVesselId));

                if (timeDiff <= timeWindow && vesselIdMatch) {

                    // Enforce one-to-one binding: skip if the point is already bound to another mission
                    if (point.boundMissionId && point.boundMissionId !== missionId) {
                        return; // point already owned
                    }
                    // Also skip if mission already bound to a different point
                    if (mission.boundPointId && mission.boundPointId !== pointId) {
                        return; // mission already has a bound point
                    }

                    // Establish one-to-one binding
                    point.boundMissionId = missionId;
                    mission.boundPointId = pointId;

                    // 計算關聯強度分數
                    const timeScore = Math.max(0, 1 - (timeDiff / timeWindow)); // 時間越近分數越高
                    const taskTypeScore = point.hasTask ? 0.3 : 0; // 有任務的軌跡點分數更高
                    const typeScore = point.type === 'Future' && mission.isScheduled ? 0.5 :
                                    point.type === 'Current' ? 0.8 : 0.2;

                    const linkScore = (timeScore * 0.5) + taskTypeScore + (typeScore * 0.2);

                    // 建立或更新關聯記錄
                    const linkKey = `${missionId}-${pointId}`;
                    if (!this.missionTrackLinks.has(linkKey)) {
                        this.missionTrackLinks.set(linkKey, {
                            missionId: missionId,
                            pointId: pointId,
                            linkTime: new Date().toISOString(),
                            linkReason: 'auto_time_vessel',
                            timeDifference: timeDiff,
                            linkScore: linkScore,
                            timeWindow: timeWindow
                        });
                    }

                    linkedCount++;
                }
            });

            console.log(`Track point ${pointId} linked to ${linkedCount} missions`);
            return linkedCount;
        }

        // 獲取任務相關的軌跡點
        getLinkedTrackPoints(missionId) {
            const mission = this.missions.get(missionId);
            if (!mission) return [];

            // one-to-one: return the single bound point as an array (for compatibility)
            if (mission.boundPointId) {
                const p = this.trackPoints.get(mission.boundPointId);
                return p ? [p] : [];
            }
            return [];
        }

        // 獲取軌跡點相關的任務
        getLinkedMissions(pointId) {
            const point = this.trackPoints.get(pointId);
            if (!point) return [];

            // one-to-one: return the single bound mission as an array (for compatibility)
            if (point.boundMissionId) {
                const m = this.missions.get(point.boundMissionId);
                return m ? [m] : [];
            }
            return [];
        }

        initializeDefaultData() {
            // 預設數據初始化邏輯
            console.log('MissionTrackPointManager initialized');
        }
    }

    window.missionTrackManager = new MissionTrackPointManager();
})();