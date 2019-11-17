import Flowchart from './flowchart_class';
import {TFlowchartData} from './flowchart_class';
import FlowChartingPlugin from './plugin';
import {TOnMappingObj} from './graph_class';
import Rule from './rule_class';
import _ from 'lodash';

declare var GFP: FlowChartingPlugin;

/**
 * Class FlowchartHandler
 */
export default class FlowchartHandler {
  $scope: ng.IScope;
  $elem : any; //TODO: elem ?
  ctrl : any ;//TODO: ctrl ?
  flowcharts : Flowchart[] = []
  currentFlowchart : string = 'Main'; // name of current Flowchart
  data : TFlowchartData[];
  firstLoad : boolean = true; // First load
  changeSourceFlag : boolean = false; // Source changed
  changeOptionFlag : boolean = true; // Options changed
  changeDataFlag: boolean = false; // Data changed
  changeRuleFlag: boolean = false; // rules changed
  static defaultXml:string = require('./defaultGraph.drawio');
  onMapping : TOnMappingObj = {
    active: false,
    object : undefined,
    id : undefined,
    $scope : undefined,
  }
  mousedownTimeout:number = 0;
  mousedown:number = 0;
  onEdit : boolean = false; // editor open or not
  editorWindow : Window|null = null; // Window draw.io editor

  /**
   * Creates an instance of FlowchartHandler to handle flowchart
   * @param {ng.IScope} $scope - angular scope
   * @param {any} elem - angular elem
   * @param {TODO:FlowchartCtrl} ctrl - ctrlPanel
   * @param {*} data - Empty data to store
   * @memberof FlowchartHandler
   */
  constructor($scope : ng.IScope, elem : any, ctrl : any, data:) {
    GFP.log.info('FlowchartHandler.constructor()');
    GFP.log.debug('FlowchartHandler.constructor() data', data);
    this.$scope = $scope || null;
    this.$elem = elem.find('.flowchart-panel__chart');
    this.ctrl = ctrl;
    this.data = data;
    this.import(this.data);

    // Events Render
    ctrl.events.on('render', () => {
      this.render();
    });

    document.body.onmousedown = () => {
      this.mousedown = 0;
      window.clearInterval(this.mousedownTimeout);
      this.mousedownTimeout = window.setInterval(() => {
        this.mousedown += 1;
      }, 200);
    };

    document.body.onmouseup = () => {
      this.mousedown = 0;
      window.clearInterval(this.mousedownTimeout);
    };
  }

  /**
   * import data into
   *
   * @param {Object} obj
   * @memberof FlowchartHandler
   */
  import(obj:any) {
    GFP.log.info('FlowchartHandler.import()');
    // GFP.log.debug('FlowchartHandler.import() obj', obj);
    // this.flowcharts.clear();
    this.flowcharts = [];
    if (obj !== undefined && obj !== null && obj.length > 0) {
      obj.forEach(map => {
        const container = this.createContainer();
        const newData = Flowchart.getDefaultData();
        const fc = new Flowchart(map.name, map.xml, container, this.ctrl, newData);
        fc.import(map);
        // this.flowcharts.set(fc.data.name,fc);
        this.flowcharts.push(fc);
        this.data.push(newData);
      });
    }
  }

  /**
   * Get flowchart with name
   *
   * @param {string} name
   * @returns {Flowchart}
   * @memberof FlowchartHandler
   */
  getFlowchart(name) {
    //TODO: When multi flowchart
    return this.flowcharts[0];
  }

  /**
   * Return array of flowchart
   *
   * @returns {Flowchart[]} Array of flowchart
   * @memberof FlowchartHandler
   */
  getFlowcharts() {
    return this.flowcharts;
  }

  /**
   *Return number of flowchart
   *
   * @returns {number} Nulber of flowchart
   * @memberof FlowchartHandler
   */
  countFlowcharts():number {
    if (this.flowcharts !== undefined && Array.isArray(this.flowcharts))
      return this.flowcharts.length;
    return 0;
  }

  /**
   *Create a div container for graph
   *
   * @returns {DOM}
   * @memberof FlowchartHandler
   */
  createContainer():HTMLDivElement {
    //TODO: Convert to createDocument
    const $container = $(
      `<div id="flowchart_${GFP.utils.uniqueID()}" style="margin:auto;position:relative,width:100%;height:100%"></div>`
    );
    this.$elem.html($container);
    return <HTMLDivElement>$container[0];
  }

  /**
   *Add a flowchart
   *
   * @param {string} name
   * @memberof FlowchartHandler
   */
  addFlowchart(name:string) {
    GFP.log.info('FlowchartHandler.addFlowchart()');
    const container = this.createContainer();
    const data = Flowchart.getDefaultData();
    const flowchart = new Flowchart(name, FlowchartHandler.defaultXml, container, this.ctrl, data);
    this.data.push(data);
    this.flowcharts.push(flowchart);
  }

  /**
   *Render for draw
   *
   * @memberof FlowchartHandler
   */
  render() {
    // not repeat render if mouse down
    let id = GFP.utils.uniqueID()
    GFP.perf.start("PERF : Render " + id);
    if (!this.mousedown) {
      let optionsFlag:boolean = false;
      let self = this;
      // SOURCE
      if (self.changeSourceFlag) {
        self.load();
        self.changeSourceFlag = false;
        self.changeRuleFlag = true;
        optionsFlag = true;
      }
      // OPTIONS
      if (self.changeOptionFlag) {
        self.setOptions();
        self.changeOptionFlag = false;
        optionsFlag = true;
      }
      // RULES or DATAS
      if (self.changeRuleFlag || self.changeDataFlag) {
        const rules = self.ctrl.rulesHandler.getRules();
        const series = self.ctrl.series;

        // Change to async to optimize
        self.async_refreshStates(rules, series);
        self.changeDataFlag = false;
        optionsFlag = false;
      }
      // OTHER : Resize, OnLoad
      if (optionsFlag || self.firstLoad) {
        self.applyOptions();
        optionsFlag = false;
        self.firstLoad = false;
      }
    }
    this.refresh();
    GFP.perf.stop("PERF : Render " + id);
  }

  /**
   * Flag source change
   *
   * @memberof FlowchartHandler
   */
  sourceChanged() {
    this.changeSourceFlag = true;
  }

  /**
   * Flag options change
   *
   * @memberof FlowchartHandler
   */
  optionChanged() {
    this.changeOptionFlag = true;
  }

  /**
   * Flag rule change
   *
   * @memberof FlowchartHandler
   */
  ruleChanged() {
    this.changeRuleFlag = true;
  }

  /**
   * Flag data change
   *
   * @memberof FlowchartHandler
   */
  dataChanged() {
    this.changeDataFlag = true;
  }

  /**
   * Refresh flowchart then graph
   *
   * @memberof FlowchartHandler
   */
  applyOptions() {
    GFP.log.info(`FlowchartHandler.applyOptions()`);
    this.flowcharts.forEach(flowchart => {
      flowchart.applyOptions();
    });
  }

  /**
   * Call refreshStates asynchronously
   *
   * @param {*} rules
   * @param {*} series
   * @memberof FlowchartHandler
   */
  async_refreshStates(rules:Rule[], series:any[]) {
    this.refreshStates(rules, series);
  }

  /**
   *Refresh rules according new rules or data
   *
   * @param {Rule[]} rules
   * @param {*} series TODO: Define type of series
   * @memberof FlowchartHandler
   */
  refreshStates(rules:Rule[], series:any[]) {
    GFP.perf.start(`${this.constructor.name}.refreshStates()`);
    if (this.changeRuleFlag) {
      this.updateStates(rules);
      this.changeRuleFlag = false;
    }
    this.setStates(rules, series);
    this.applyStates();
    GFP.perf.stop(`${this.constructor.name}.refreshStates()`);
  }

  refresh() {
    this.flowcharts.forEach(flowchart => {
      flowchart.refresh();
    });
  }


  /**
   * Change states of cell according to rules and series
   *
   * @param {Rule[]} rules
   * @param {any[]} series
   * @memberof FlowchartHandler
   */
  setStates(rules:Rule[], series:any[]) {
    GFP.perf.start(`${this.constructor.name}.setStates()`);
    this.flowcharts.forEach(flowchart => {
      flowchart.setStates(rules, series);
    });
    GFP.perf.stop(`${this.constructor.name}.setStates()`);
  }

  /**
   * Update states with rule
   *
   * @param {Rule[]} rules
   * @memberof FlowchartHandler
   */
  updateStates(rules:Rule[]) {
    GFP.perf.start(`${this.constructor.name}.updateStates()`);
    this.flowcharts.forEach(flowchart => {
      flowchart.updateStates(rules);
    });
    GFP.perf.stop(`${this.constructor.name}.updateStates()`);
  }

  /**
   * Apply state of cell after setStates
   *
   * @memberof FlowchartHandler
   */
  applyStates() {
    GFP.perf.start(`${this.constructor.name}.applyStates()`);
    new Promise(() => {
      this.flowcharts.forEach(flowchart => {
        flowchart.applyStates();
      });
    })
      .then(() => {
        this.refresh();
      }
      )
    GFP.perf.stop(`${this.constructor.name}.applyStates()`);
  }

  /**
   *Apply and set options
   *
   * @memberof FlowchartHandler
   */
  setOptions() {
    this.flowcharts.forEach(flowchart => {
      flowchart.setOptions();
    });
  }

  /**
   *(re)draw graph
   *
   * @memberof FlowchartHandler
   */
  draw() {
    GFP.log.info(`FlowchartHandler.draw()`);
    this.flowcharts.forEach(flowchart => {
      flowchart.redraw();
    });
  }

  /**
   *(re)load graph
   *
   * @memberof FlowchartHandler
   */
  load() {
    GFP.log.info(`FlowchartHandler.load()`);
    this.flowcharts.forEach(flowchart => {
      flowchart.reload();
    });
  }

  /**
   *Active option link/map
   *
   * @param {Object} objToMap
   * @memberof FlowchartHandler
   */
  setMap(objToMap) {
    const flowchart = this.getFlowchart(this.currentFlowchart);
    this.onMapping.active = true;
    this.onMapping.object = objToMap;
    this.onMapping.id = objToMap.getId();
    this.onMapping.$scope = this.$scope;
    flowchart.setMap(this.onMapping);
  }

  /**
   *Desactivate option
   *
   * @memberof FlowchartHandler
   */
  unsetMap() {
    const flowchart = this.getFlowchart(this.currentFlowchart);
    this.onMapping.active = false;
    this.onMapping.object = undefined;
    this.onMapping.id = '';
    flowchart.unsetMap();
  }

  /**
   *Return true if mapping object is active
   *
   * @param {properties} objToMap
   * @returns true - true if mapping mode
   * @memberof FlowchartHandler
   */
  isMapping(objToMap) {
    if (objToMap === undefined || objToMap == null) return this.onMapping.active;
    if (this.onMapping.active === true && objToMap === this.onMapping.object) return true;
    return false;
  }

  listenMessage(event:MessageEvent) {
    if (event.data === 'ready') {
      // send xml
      if(event.source) {
        if (!(event.source instanceof MessagePort) && !(event.source instanceof ServiceWorker))
        event.source.postMessage(this.getFlowchart(this.currentFlowchart).data.xml, event.origin);
      }
    } else {
      if (this.onEdit && event.data !== undefined && event.data.length > 0) {
        this.getFlowchart(this.currentFlowchart).redraw(event.data);
        this.sourceChanged();
        this.$scope.$apply();
        this.render();
      }
      if ((this.onEdit && event.data !== undefined) || event.data.length === 0) {
        if(this.editorWindow) this.editorWindow.close();
        this.onEdit = false;
        window.removeEventListener('message', this.listenMessage.bind(this), false);
      }
    }
  }

  /**
   *Open graph in draw.io
   *
   * @memberof FlowchartHandler
   */
  openDrawEditor() {
    const urlEditor = this.getFlowchart(this.currentFlowchart).getUrlEditor();
    const theme = this.getFlowchart(this.currentFlowchart).getThemeEditor();
    const urlParams = `${urlEditor}?embed=1&spin=1&libraries=1&ui=${theme}`;
    this.editorWindow = window.open(urlParams, 'MxGraph Editor', 'width=1280, height=720');
    this.onEdit = true;
    window.addEventListener('message', this.listenMessage.bind(this), false);
  }
}
