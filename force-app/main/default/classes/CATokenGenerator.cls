public with sharing class CATokenGenerator {

    public CATokenGenerator() {

    }
    // When using secure credentials in custom LWCs, the values can be stored in in Custom Metadata, Custom Settings, Named Credentials, or Protected Custom Metadata. 
    // This example is using Custom Metadata.
    private static TableauConnectedApp__mdt ca;
    private static String ts_ca_iss;
    private static String ts_ca_kid;
    private static String ts_ca_secret;

    @AuraEnabled(cacheable=false)
    public static List<TableauConnectedApp__mdt> getTableauEnvConfig() {
        // DeveloperName is unique id
        List<TableauConnectedApp__mdt> tabEnv = [SELECT DeveloperName, secret__c, kid__c, clientId__c, SiteName__c, TableauCloud__c  FROM TableauConnectedApp__mdt];
    
        System.debug('tabEnv: ' + tabEnv[0]);
        ca = tabEnv[0];
        ts_ca_iss = ca.clientId__c;
        ts_ca_kid = ca.kid__c;
        ts_ca_secret = ca.secret__c;
        return tabEnv;
    }


    // Get views from custom metadata
    @AuraEnabled(cacheable=false)
    public static List<TableauView__mdt> getViews() {
        // DeveloperName is unique id
        List<TableauView__mdt> views = [SELECT DeveloperName, contentUrl__c, viewName__c FROM TableauView__mdt];
    
        // Log the entire list of views
        System.debug('Views: ' + views);
        return views;
    }


    @AuraEnabled(cacheable=false)
    public static Map<String, String> getUserDetails() {
        // Get the user's division, email, and account name
        User currentUser = [SELECT Email, Division, ContactId FROM User WHERE Id = :UserInfo.getUserId()];
        String accountName = '';

        if (currentUser.ContactId != null) {
            // Query the Contact to get the Account Name
            Contact userContact = [SELECT Account.Name FROM Contact WHERE Id = :currentUser.ContactId];
            accountName = userContact.Account.Name;
            System.debug('Account Name: ' + accountName);
        }

        Map<String, String> userDetails = new Map<String, String>{
            'Email' => currentUser.Email,
            'Division' => currentUser.Division,
            'Account' => accountName
        };
        return userDetails;
    }

    // helper to convert comma delimited strings to list
    public static List<String> convertStringToList(String input) {
        return input.split(',\\s*');
    }

    // helper to get aauthenticated user's username
    public static String getCurrentUserUsername() {
        User currentUser = [SELECT Username FROM User WHERE Id = :UserInfo.getUserId()];
        return currentUser.Username;
    }

    // helper method for base64 url encoding
    private static String base64UrlEncode(Blob input) {
        String output = EncodingUtil.base64Encode(input);
        output = output.replace('+', '-');
        output = output.replace('/', '_');
        output = output.replace('=', '');
        return output;
    }

    // helper to create a list of required Tableau claims
    public static List<String> getTableauClaims(String input) { 
        List<String> scopes;
        if (input == 'SSO') {
            // Add tableau scopes (List)
            scopes = new List<String>{
                'tableau:views:embed',
                'tableau:views:embed_authoring',
                'tableau:metrics:embed',
                'tableau:insights:embed'
            };
        } else if (input == 'REST_API') {
            // Add tableau scopes (List)
            scopes = new List<String>{
                'tableau:content:read',
                'tableau:views:download',
                'tableau:views:embed',
                'tableau:views:embed_authoring',
                'tableau:metrics:embed'
            };
        }
        return scopes;
    }
   
    // Returns JWT (String)
    // @AuraEnabled annotation makes the method accessible via LWC 
    @AuraEnabled(cacheable=false)
    public static String generateJWT(String tokenType) {
        // get secret, secret_id, client_id from custom meta data object 
        getTableauEnvConfig();

        // Header (Map)
        Map<String, String> header = new Map<String, String>();
        header.put('alg', 'HS256');
        header.put('iss', ts_ca_iss);
        header.put('kid', ts_ca_kid);
        header.put('typ', 'JWT');
        // Claims (Map)
        Map<String, Object> claims = new Map<String, Object>();
        claims.put('iss', ts_ca_iss);
        // Add expiration
        Datetime now = Datetime.now();
        Datetime exp = now.addMinutes(5);
        claims.put('exp', exp.getTime()/1000); // Convert to seconds
        // Add UUID
        Blob base = Crypto.GenerateAESKey(128);
        String h = EncodingUtil.ConvertTohex(base);
        String uuid = h.SubString(0,8)+ '-' + h.SubString(8,12) + '-' + h.SubString(12,16) + '-' + h.SubString(16,20) + '-' + h.substring(20);
        claims.put('jti', uuid); 
        claims.put('aud', 'tableau');
        claims.put('sub', getCurrentUserUsername());
        List<String> scp = getTableauClaims(tokenType);
        claims.put('scp', scp);
       
        // uafValuesList = convertStringToList(uafValues);
        // claims.put('Agent Name', uafValuesList);

        String currentUserEmail = getCurrentUserUsername(); 
       
        if (currentUserEmail == 'justinchen@demo.com'){
            String uafValuesFINS = 'Justin Chen';
            List<String> uafValuesListFINS = convertStringToList(uafValuesFINS);
            claims.put('Agent Name', uafValuesListFINS);
            String uafValuesRegion = 'East';
            List<String> uafValuesListRegion = convertStringToList(uafValuesRegion);
            claims.put('Region', uafValuesListRegion);
        }

        // Encode Header and Claims
        String encodedHeader = base64UrlEncode(Blob.valueOf(JSON.serialize(header)));
        String encodedClaims = base64UrlEncode(Blob.valueOf(JSON.serialize(claims)));
        // Create JWT
        String jwt = encodedHeader + '.' + encodedClaims;
        // Sign JWT 
        Blob hmacData = Crypto.generateMac('hmacSHA256', Blob.valueOf(jwt), Blob.valueOf(ts_ca_secret));
        // Encode JWT
        String signature = base64UrlEncode(hmacData);
        // Add signature to JWT
        jwt += '.' + signature;
        return jwt;
    }
}