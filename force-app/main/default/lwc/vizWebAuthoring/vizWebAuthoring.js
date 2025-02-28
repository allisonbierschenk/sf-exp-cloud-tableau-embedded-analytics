import {
    LightningElement, track
} from 'lwc';
import generateJWT from '@salesforce/apex/CATokenGenerator.generateJWT';
import getUserDetails from '@salesforce/apex/CATokenGenerator.getUserDetails';
import getTableauEnvConfig from '@salesforce/apex/CATokenGenerator.getTableauEnvConfig';
import { NavigationMixin } from 'lightning/navigation';
import { loadScript } from 'lightning/platformResourceLoader';

export default class VizWebAuthoring extends NavigationMixin(LightningElement) {
    @track jwt;
    @track userDetails;

    server;
    site;
    baseUrl;
    guid = crypto.randomUUID(); // Generate a unique GUID
    SCRIPT_PATH;
    SCRIPT_PATH_ALT;
    isInitialized = false;

    async init() {
        this.baseUrl = window.location.origin;
        console.log('Current Domain:', this.baseUrl);

        this.SCRIPT_PATH = '/js/tableau/tableau.embedding.latest.min.js';
        this.SCRIPT_PATH_ALT = '/sfsites/c' + this.SCRIPT_PATH;

        loadScript(this, this.baseUrl + this.SCRIPT_PATH)
            .catch(() => {
                console.log('Fallback to:', this.SCRIPT_PATH_ALT);
                return loadScript(this, this.baseUrl + this.SCRIPT_PATH_ALT);
            })
            .then(() => getTableauEnvConfig())
            .then(result => {
                this.server = result[0].TableauCloud__c;
                this.site = result[0].SiteName__c;
                return getUserDetails();
            })
            .then(result => {
                this.userDetails = result;
                return generateJWT({ tokenType: 'SSO' });
            })
            .then(() => {
                this.initViz();
            })
            .catch(error => {
                console.log("Error:", JSON.stringify(error));
            });
    }

    renderedCallback() {
        if (!this.isInitialized) {
            this.init();
            this.isInitialized = true;
        }
    }

    get vizUrl() {
        if (this.server && this.site) {
            return `${this.server}/t/${this.site}/authoringNewWorkbook/${this.guid}/Joined`;
        }
        console.log("Missing required parameters for vizUrl");
        return '';
    }

    async initViz() {
        const container = this.template.querySelector('[data-id="tableauViz"]');
        if (container) {
            container.token = this.jwt;
            container.src = this.vizUrl;

            console.log('Authoring Viz Loaded:');
            console.log('container.token:', container.token);
            console.log('container.src:', container.src);
        }
    }
}
