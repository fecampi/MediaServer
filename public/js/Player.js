// Classe principal do player HLS
class Player {
  constructor(videoEl) {
    this.video = videoEl;
    this.hls = null;
    this._setupLogs();
    this._attachVideoEvents();
  }

  // --------------------------

  log(...a) {
    console.log("[PLAYER]", ...a);
  }

  logErr(...a) {
    console.error("[PLAYER ERROR]", ...a);
  }

  _setupLogs() {
    window.__playerLog = this.log.bind(this);
    window.__playerLogErr = this.logErr.bind(this);
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
    this.log("load:", url);

    if (!url) {
      this.logErr("URL vazia");
      return;
    }

    this.destroy(); // garante que não existe hls anterior

    const lower = url.toLowerCase();

    if (lower.endsWith(".mp4")) {
      return this._playMp4(url);
    }

    // Nativo em Safari
    if (this.video.canPlayType("application/vnd.apple.mpegurl")) {
      return this._playNativeHls(url);
    }

    // hls.js
    if (window.Hls && Hls.isSupported()) {
      return this._playHlsJS(url);
    }

    this.logErr("Nenhuma tecnologia suporta esta URL");
    this.video.src = url;
    this.video.play().catch(this.logErr);
  }


  _playMp4(url) {
    this.log("MP4 detectado (nativo)");
    this.video.src = url;
    this.video.load();
    this.video.play().catch(this.logErr);
  }


  _playNativeHls(url) {
    this.log("HLS nativo detectado");
    this.video.src = url;
    this.video.load();
    this.video.play().catch(this.logErr);
  }


  _playHlsJS(url) {
    this.log("HLS via hls.js");

    const hls = new Hls();
    this.hls = hls;

    hls.on(Hls.Events.MEDIA_ATTACHED, () => this.log("HLS: MEDIA_ATTACHED"));
    hls.on(Hls.Events.MANIFEST_LOADING, () => this.log("HLS: MANIFEST_LOADING"));
    hls.on(Hls.Events.MANIFEST_PARSED, (e, d) => {
      this.log("HLS: MANIFEST_PARSED, níveis:", d.levels?.length);
    });
    hls.on(Hls.Events.FRAG_LOADING, (e, d) =>
      this.log("HLS: FRAG_LOADING", d.frag?.url)
    );
    hls.on(Hls.Events.FRAG_LOADED, (e, d) =>
      this.log("HLS: FRAG_LOADED sn =", d.frag?.sn)
    );
    hls.on(Hls.Events.ERROR, (e, d) => this.logErr("HLS ERROR", d));

    hls.attachMedia(this.video);
    hls.loadSource(url);

    this.video.play().catch(this.logErr);
  }


  _attachVideoEvents() {
    [
      "loadstart",
      "loadedmetadata",
      "loadeddata",
      "canplay",
      "canplaythrough",
      "waiting",
      "playing",
      "pause",
      "ended",
      "error",
    ].forEach((evt) => {
      this.video.addEventListener(evt, () => this.log("<video> event:", evt));
    });
  }
}