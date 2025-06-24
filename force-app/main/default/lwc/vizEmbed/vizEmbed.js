
import {
    LightningElement, track
} from 'lwc';
import generateJWT from '@salesforce/apex/CATokenGenerator.generateJWT';
import getUserDetails from '@salesforce/apex/CATokenGenerator.getUserDetails';
import getViews from '@salesforce/apex/CATokenGenerator.getViews';
import getTableauEnvConfig from '@salesforce/apex/CATokenGenerator.getTableauEnvConfig';
import { NavigationMixin } from 'lightning/navigation';
import { loadScript } from 'lightning/platformResourceLoader';


export default class VizEmbed extends NavigationMixin(LightningElement)  {
    @track jwt;
    @track userDetails;

    viz;
    sheet;
    targetSheet;
    tokenType = 'SSO';
    contentUrl;
    views;
    viewUrl;
    server;
    site;
    workbook;
    view;
    path = '/t/';
    params = '?:embed=y';
    baseUrl;
    SCRIPT_PATH;
    SCRIPT_PATH_ALT;
    isInitialized = false; // Flag to prevent multiple executions

    async init() {
        // Get the current domain dynamically
        this.baseUrl = window.location.origin;
        console.log('Current Domain: ' + this.baseUrl);

        this.SCRIPT_PATH = '/js/tableau/tableau.embedding.latest.min.js';
        this.SCRIPT_PATH_ALT = '/sfsites/c' + this.SCRIPT_PATH;

        // Load the Tableau Embed v3 API script
        loadScript(this, this.baseUrl + this.SCRIPT_PATH)
            .then(() => {
                console.log('Tableau Embed v3 API script loaded successfully.');
            })
            .catch(() => {
                console.log('Tableau Embed v3 API script failed to load using ' + this.SCRIPT_PATH + ' - now trying ' + this.SCRIPT_PATH_ALT);
                return loadScript(this, this.baseUrl + this.SCRIPT_PATH_ALT);
            })
            .then(() => {
                return getTableauEnvConfig();
            })
            .then(result => {
                // Handle the result from the second call
                console.log('tabEnv: ' + JSON.stringify(result));
                this.server = result[0].TableauCloud__c;
                this.site = result[0].SiteName__c;
                
                // Third Apex call getViews
                return getUserDetails();
            })
            .then(result => {
                // Handle the result from the first call
                this.userDetails = result;
                console.log('userDetails: ' + JSON.stringify(this.userDetails));
    
                // Second Apex call generateJWT
                return generateJWT({ tokenType: this.tokenType });
            })
            .then(result => {
                // Handle the result from the second call
                this.jwt = result;
                console.log('JWT: ' + this.jwt);
                console.log('Link to decode token: https://jwt.io/#debugger-io?token=' + this.jwt);
                
                // Third Apex call getViews
                return getViews();
            })
            .then(result => {
                // Handle the result from the thrid call
                // Normalize the view properties to those found in REST API response (name, contentUrl, etc.)
                this.views = result.map(item => {
                    return {
                        ...item,
                        contentUrl: item.contentUrl__c,
                        name: item.viewName__c,
                        id: item.Id,
                        contentUrl__c: undefined,
                        viewName__c: undefined,
                        Id: undefined
                    };
                });
                console.log('Views:', JSON.stringify(this.views));
                // load view at index 0 on first page load
                // TODO: improve to index off of name instead of index int
                this.contentUrl = this.views[0].contentUrl;
                this.initViz(false); // Init viz after all the apex calls
                this.addEventListener('customclick', this.handleCustomClick.bind(this));
            })
            .catch(error => {
                // Handle error
                console.log("error: " + JSON.stringify(error));
            });
    }

    renderedCallback() {
        console.log('renderedCallback fired!');
        console.log('The current value of this.isInitialized is: ' + this.isInitialized);
        if (!this.isInitialized) {
            this.init();
            this.isInitialized = true;
            console.log('Initializing component, and setting this.isInitialized to: ' + this.isInitialized);
        } else {
            console.log('renderedCallback previously called so skipping init()');
        }
    }

    get tableauContainer() {
        console.log('tableauContainer fired!');
        return this.template.querySelector('.tableau-target-div');
    }

    get vizUrl() {
        console.log('vizUrl fired!');
        if (this.contentUrl) {
            let parts = this.contentUrl.split('/');
            this.view = parts[parts.length - 1];
            this.workbook = parts[0];
            this.viewUrl = this.server + this.path + this.site + '/views/' + this.workbook + '/' + this.view + this.params;
        }
        else {
            console.log('ERROR: No url found in local stoarge');
            this.viewUrl = this.server + this.path + this.site + '/views/' + this.workbook + '/' + this.view + this.params;
        }
        console.log("this.viewUrl: " + this.viewUrl);
        return this.viewUrl;
    }

    // In the initViz1() method, we create the viz object from the HTML element (container), and then use the viz object to programatically configure the embedded viz.
    // This approach requires the <tableau-viz> web component to be included in the HTML
    async initViz(fromMenuClick) {
        console.log('initViz fired!');
        const container = this.tableauContainer;
        console.log('this.contentUrl:', this.contentUrl);
        console.log('this.vizUrl:', this.vizUrl);
        console.log('container:', container);

        
        if (container) {
            // set viz properties
            container.height = '1000px';
            container.width = '100%';
            container.token = this.jwt;
            container.src = this.vizUrl;
            container.toolbar = 'top';
            container.hideTabs = true;
            container.toolbar = 'hidden';

            console.log('container.token: ' + container.token);
            console.log('container.src: ' + container.src);

            let tableauVizElement = this.template.querySelector('[data-id="tableauViz"]');

            tableauVizElement.addEventListener('vizloaderror', (errorEvent) => {
                console.log('error loading viz');
                const message = JSON.parse(errorEvent.detail.message);
                console.log('error message @ viz load: ' + message);
            });
            
      
            // Listen for the 'firstinteractive' event, which is fired when the viz has finished loading
            tableauVizElement.addEventListener('firstinteractive', (onFirstInteractiveEvent) => {
                console.log('viz loaded!');
                console.log('target: ' + onFirstInteractiveEvent.target);
                this.viz = onFirstInteractiveEvent.target;
                this.sheet = this.viz.workbook.activeSheet;
                console.log("sheet name: " + this.sheet.name);
                console.log('sheetType: ' + this.sheet.sheetType);
                this.targetSheet = this.sheet.worksheets.find(ws => ws.name === "Sale Map");
                console.log("targetSheet: " + this.targetSheet);
            });
        }
    }
}