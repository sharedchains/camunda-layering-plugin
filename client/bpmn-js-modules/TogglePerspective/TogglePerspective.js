import { domify, event as domEvent } from 'min-dom';

export default function TogglePerspective(eventBus, canvas, layerManager) {
  var self = this;

  this._eventBus = eventBus;
  this._canvas = canvas;
  this._layerManager = layerManager;
  this.oldElementsMarked = [];

  this._eventBus.on('import.done', () => self._init());
}

TogglePerspective.prototype._init = function() {
  this.container = domify(`
    <div class="toggle-perspective">
        <label for="perspective">Current perspective:&nbsp;</label>
    </div>
  `);
  let selectElement = domify(`<select name="perspective">
    <option value="global" selected>Global</option>
    <option value="control">Control-flow</option>
    <option value="data">Data</option>
  </select>`);

  domEvent.bind(selectElement, 'change', this.changePerspective.bind(this));

  this.container.appendChild(selectElement);
  this._canvas.getContainer().appendChild(this.container);
};

TogglePerspective.prototype.changePerspective = function(event) {
  let elements = this._layerManager.getElements(event.target.value) || [];
  this.oldElementsMarked.forEach(elementId => {
    this._canvas.removeMarker(elementId, 'disabled-element');
  });
  elements.forEach(elementId => {
    this._canvas.addMarker(elementId, 'disabled-element');
  });
  this.oldElementsMarked = elements;

  // TODO: Disable modeling on elements
};

TogglePerspective.$inject = ['eventBus', 'canvas', 'layerManager'];