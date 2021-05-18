import Modeler from 'bpmn-js/lib/Modeler';

import LayersModule from '../../client/bpmn-js-modules';

import {
  bootstrapModeler,
  inject
} from 'test/TestHelper';

import lanesDiagram from '../bpmn/lanes.bpmn';

import { find } from 'lodash';

describe('LayerManager test', () => {

  function stringify(val, depth, replacer, space) {
    depth = isNaN(+depth) ? 1 : depth;

    function _build(key, val, depth, o, a) { // (JSON.stringify() has it's own rules, which we respect here by using it for property iteration)
      return !val || typeof val != 'object' ? val : (a = Array.isArray(val), JSON.stringify(val, function(k, v) {
        if (a || depth > 0) {
          if (replacer) v = replacer(k, v);
          if (!k) return (a = Array.isArray(v), val = v);
          !o && (o = a ? [] : {});
          o[k] = _build(k, v, a ? depth : depth - 1);
        }
      }), o || (a ? [] : {}));
    }

    return JSON.stringify(_build('', val, depth), null, space);
  };

  function bootstrapDiagram(diagram) {
    beforeEach(bootstrapModeler(diagram, {
      additionalModules: [].concat(Modeler.prototype._modules).concat([
        LayersModule
      ]),
      keyboard: {
        bindTo: document
      }
    }));
  }

  describe('Lanes diagram', () => {
    bootstrapDiagram(lanesDiagram);

    it('should load layerManager', function(done) {
      inject(function(layerManager) {

        // given the lanes diagram
        // when
        let elements = layerManager.getElements();
        expect(elements).to.be.an('array').that.is.not.empty;

        done();
      })();
    });

    it('should return only data elements (to hide, selecting control-flow)', function(done) {
      inject(function(layerManager) {

        // given the lanes diagram
        // when
        let elements = layerManager.getElements('control');
        expect(elements).to.be.an('array').that.has.length(3);

        done();
      })();
    });

    it('should return only control-flow elements (to hide, selecting data)', function(done) {
      inject(function(layerManager) {

        // given the lanes diagram
        // when
        let elements = layerManager.getElements('data');
        expect(elements).to.be.an('array').that.has.length(15);

        done();
      })();
    });

    it('should return pool hierarchy - no elements', function(done) {
      inject(function(layerManager) {

        // given the lanes diagram
        // when
        let pools = layerManager.getResources();
        expect(pools).to.be.an('array').that.has.length(2);

        let alfaPool = find(pools, { id: 'Alfa' });
        expect(alfaPool.lanes).to.be.an('array').that.include.members(['A', 'B']);

        let betaPool = find(pools, { id: 'Beta' });
        expect(betaPool.lanes).to.be.an('array').that.is.empty;

        done();
      })();
    });

    it('should return pool hierarchy - with elements', function(done) {
      inject(function(layerManager) {

        // given the lanes diagram
        // when
        let pools = layerManager.getResources(true);
        expect(pools).to.be.an('array').that.has.length(2);

        let alfaPool = find(pools, { id: 'Alfa' });
        expect(alfaPool.lanes).to.be.an('array').that.deep.includes({ 'A': ['StartEvent', 'Activity_1', 'EndEvent_1'] });
        expect(alfaPool.lanes).to.be.an('array').that.deep.includes({ 'B': ['ThrowEvent_1', 'Activity_2'] });

        let betaPool = find(pools, { id: 'Beta' });
        expect(betaPool.lanes).to.be.an('array').that.is.empty;

        done();
      })();
    });

    // TODO: tests adding and removing elements
  });

});