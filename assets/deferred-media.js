class DeferredMedia extends HTMLElement {
    constructor() {
        super();
        this.querySelector('[id^="Deferred-Poster-"]')?.addEventListener('click', this.loadContent.bind(this));
    }

    loadContent() {
        if (!this.getAttribute('loaded')) {
            const templateContent = this.querySelector('template').content.cloneNode(true);
            const content = document.createElement('div');
            content.appendChild(templateContent);

            this.setAttribute('loaded', true);
            window.pauseAllMedia();
            
            const elements = content.querySelectorAll('video, model-viewer, iframe');
            elements.forEach(element => this.appendChild(element));
        }
    }
}

customElements.define('deferred-media', DeferredMedia);