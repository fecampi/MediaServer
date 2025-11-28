class Player {
  constructor(videoEl) {
    this.video = videoEl;
    this.hls = null;

    this._setupLogs();
    this._attachVideoEvents();
    this._interstitialTimer = null;
  }

  // -------------------------
  // LOGS
  // -------------------------

  _setupLogs() {
    this.log = (...a) => console.log("[PLAYER]", ...a);
    this.logErr = (...a) => console.error("[PLAYER ERROR]", ...a);
  }

  destroy() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
      this.log("Hls.js destruído");
    }
    this.video.src = "";
  }

  load(url) {
    this.log("Carregando:", url);

    this.destroy();

    if (!url) return this.logErr("URL vazia");

    if (url.toLowerCase().endsWith(".mp4")) {
      return this._playMp4(url);
    }

    // Prioriza Hls.js (para ter interstitials) sobre HLS nativo
    if (window.Hls && Hls.isSupported()) {
      return this._playHlsJS(url);
    }

    if (this.video.canPlayType("application/vnd.apple.mpegurl")) {
      return this._playNativeHls(url);
    }

    this.logErr("Nenhuma tecnologia suporta esta URL");
  }

  _playMp4(url) {
    this.log("MP4 nativo");
    this.video.src = url;
    this.video.play().catch(this.logErr);
  }

  _playNativeHls(url) {
    this.log("HLS nativo");
    this.video.src = url;
    this.video.play().catch(this.logErr);
  }

  // ======================================================
  //  HLS.js + INTERSTITIALS
  // ======================================================
  _playHlsJS(url) {
    this.log("HLS via Hls.js (com interstitials)");

    const hls = new Hls({
      maxBufferLength: 60, // buffer alvo de ~20s
      maxMaxBufferLength: 120, // nunca ultrapassa 60s de buffer
      enableMetadata: true,
      lowLatencyMode: true,
      interstitialsUseSameMedia: true,
      enableInterstitialPlayback: true,
      interstitialAppendInPlace: true,
      interstitialLiveLookAhead: 20,
    });

    this.hls = hls;

    // ---- EVENTOS DE MANIFEST E QUALIDADE ----

    // Quando o manifest master é carregado
    hls.on(Hls.Events.MANIFEST_LOADING, (evt, data) => {
      this.log("MANIFEST_LOADING:", data);
    });

    // Quando o manifest é carregado e parseado
    hls.on(Hls.Events.MANIFEST_PARSED, (evt, data) => {
      this.log("MANIFEST_PARSED:", data);
    });

    // Quando carrega os detalhes de uma variante (playlist de mídia)
    hls.on(Hls.Events.LEVEL_LOADED, (evt, data) => {
      this.log(`LEVEL_LOADED - Variante ${data.level}:`);

      // Tentar pegar o texto original do manifest
      let m3u8Text = null;

      if (data.networkDetails?.response) {
        m3u8Text = data.networkDetails.response;
      } else if (data.details?.text) {
        m3u8Text = data.details.text;
      } else if (data.details?.payload) {
        m3u8Text = data.details.payload;
      }

      if (m3u8Text) {
        this.log(`\n🔍 MANIFEST ORIGINAL (${data.details.url}):\n`);
        console.log(m3u8Text);
      } else {
        this.log("Texto original não disponível:", data);
      }
    });

    // Quando muda de qualidade/variante
    hls.on(Hls.Events.LEVEL_SWITCHED, (evt, data) => {
      this.log(`LEVEL_SWITCHED para nível ${data.level}`);
    });

    // ---- EVENTOS DE INTERSTITIALS ----

    // Armazena o próximo interstitial
    this._nextInterstitial = null;

    // Quando a lista de interstitials é atualizada
    hls.on(Hls.Events.INTERSTITIALS_UPDATED, (evt, data) => {
      if (Array.isArray(data.schedule)) {
        this._nextInterstitial =
          data.schedule.find((item) => item.start > this.video.currentTime) ||
          null;
        if (this._nextInterstitial) {
          this.log(
            `Próxima interação/interstitial em: ${(
              this._nextInterstitial.start - this.video.currentTime
            ).toFixed(1)} segundos`
          );
        } else {
          this.log("Nenhuma interação/interstitial futura encontrada.");
        }
      }
    });

    // Atualiza o tempo restante em tempo real
    this.video.addEventListener("timeupdate", () => {
      // Tempo até o próximo interstitial
      if (this._nextInterstitial) {
        const timeLeft = this._nextInterstitial.start - this.video.currentTime;
        if (timeLeft > 0) {
          this.log(
            `Próxima interação/interstitial em: ${timeLeft.toFixed(1)} segundos`
          );
        }
      }
      // Tempo para sair do interstitial atual
      if (this._currentInterstitialEnd) {
        const leaveTime = this._currentInterstitialEnd - this.video.currentTime;
        if (leaveTime > 0) {
          this.log(
            `Tempo restante para sair do interstitial: ${leaveTime.toFixed(
              1
            )} segundos`
          );
        }
      }
    });

    // Quando um interstitial começa
    hls.on(Hls.Events.INTERSTITIAL_STARTED, (evt, data) => {
      const dur = data.dateRange?.attr?.DURATION;
      if (typeof dur === "number") {
        this._currentInterstitialEnd = this.video.currentTime + dur;
        this.log(
          `Tempo restante para sair do interstitial: ${dur.toFixed(1)} segundos`
        );
      } else {
        this._currentInterstitialEnd = null;
        this.log("Duração do interstitial não informada.");
      }
      this.log("INTERSTITIAL_STARTED:", data);
    });

    // Quando um interstitial termina
    hls.on(Hls.Events.INTERSTITIAL_ENDED, (evt, data) => {
      this._currentInterstitialEnd = null;
      this.log("INTERSTITIAL_ENDED:", data);
    });

    // Quando retorna ao conteúdo principal
    hls.on(Hls.Events.INTERSTITIALS_PRIMARY_RESUMED, (evt, data) => {
      this.log("INTERSTITIALS_PRIMARY_RESUMED:", data);
    });

    hls.on(Hls.Events.ERROR, (e, err) => {
      this.logErr("HLS ERROR:", err);
    });

    hls.attachMedia(this.video);
    hls.loadSource(url);

    this.video.play().catch(this.logErr);
  }

  // ======================================================
  // EVENTOS <video>
  // ======================================================
  _attachVideoEvents() {
    [
      "loadedmetadata",
      "canplay",
      "playing",
      "pause",
      "waiting",
      "ended",
      "error",
    ].forEach((evt) => {
      this.video.addEventListener(evt, () => this.log(`<video> ${evt}`));
    });
  }
}
