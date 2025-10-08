// VesselDataGenerator - 船隻資料生成器
(function(){
  class VesselDataGenerator {
    constructor() {
      this.vesselNames = [
        '海龍號', '遠洋之星', '藍鯨', '金剛', '勝利號',
        '太平洋', '海鷗號', '順風號', '長城', '和平號',
        '福星號', '龍騰', '雄鷹', '晨曦', '希望'
      ];
    }

    /**
     * 生成隨機船隻資料
     */
    generateRandomVessel() {
      const riskScore = this.generateRiskScore();
      const coordinates = this.generateSeaCoordinate();

      return {
        mmsi: this.generateMMSI(),
        vesselName: this.getRandomVesselName(),
        coordinates: coordinates.string,
        lat: coordinates.lat,
        lon: coordinates.lon,
        riskScore: riskScore,
        aisStatus: Math.random() > 0.5 ? '已開啟' : '未開啟',
        speed: Math.random() * 30,
        course: Math.floor(Math.random() * 360),
        timestamp: new Date().toISOString(),
        investigationReason: riskScore >= 70 ? this.getHighRiskReason() : '例行監控'
      };
    }

    /**
     * 生成威脅分數 (30%機率≥70)
     */
    generateRiskScore() {
      // 30% 機率生成高風險（≥70）
      if (Math.random() < 0.3) {
        return Math.floor(Math.random() * 30) + 70; // 70-100
      }
      return Math.floor(Math.random() * 70); // 0-69
    }

    /**
     * 生成隨機 MMSI
     */
    generateMMSI() {
      return '416' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    }

    /**
     * 隨機選擇船舶名稱
     */
    getRandomVesselName() {
      return this.vesselNames[Math.floor(Math.random() * this.vesselNames.length)];
    }

    /**
     * 生成海域座標
     */
    generateSeaCoordinate() {
      const lat = 10 + Math.random() * 15; // 10°N - 25°N
      const lon = 109 + Math.random() * 12; // 109°E - 121°E

      return {
        lat: lat,
        lon: lon,
        string: `${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E`
      };
    }

    /**
     * 取得高風險原因
     */
    getHighRiskReason() {
      const reasons = [
        'AIS 信號異常關閉',
        '航線嚴重偏離',
        '進入禁航區域',
        '異常高速航行',
        '頻繁變更航向',
        'RF 信號異常',
        '未經授權進入管制區'
      ];
      return reasons[Math.floor(Math.random() * reasons.length)];
    }
  }

  // 暴露全局實例
  window.vesselDataGenerator = new VesselDataGenerator();
  console.log('✅ VesselDataGenerator 已初始化');
})();
