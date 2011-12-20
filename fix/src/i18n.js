// internationalization language resources
woas.i18n = {
	ACCESS_DENIED: "Access denied to the '%s' page.",
	ALT_BROWSER_INPUT: "This browser is not allowing the directory path to be read directly.\n\nPlease specify the full path to the '%s' file.",
	ASK_MENU_LINK: "Do you want the menu to have a link to this page?",
	B64_REQ: " (requires %s due to base64 encoding)",
	CANCEL_EDITING:"Changes to this page will not be saved.",
	CANNOT_LOCK_RESERVED: "You cannot lock a page in a reserved namespace.",
	CHOOSE_CANCEL: "\n\nIf you don't want this to happen choose Cancel.",
	CONFIRM_OVERWRITE: "Page \"%s\" already exists. Overwrite it?",
	CONFIRM_DELETE:"Are you sure you want to DELETE the '%s' page?",
	CONFIRM_DELETE_ALL1: "You are about to ERASE all your pages.\n\nDo you want to continue?",
	CONFIRM_DELETE_ALL2: "This is the last confirmation needed before ERASING all your pages.\n\nALL YOUR PAGES WILL BE LOST\n\nAre you sure you want to continue?",
	CONFIRM_DELETE_IMAGE: "Are you sure you want to delete the '%s' image?",
	CONFIRM_EXPORT: "Export '%s' to the path specified below?",
	CONFIRM_LOCK: "Do you want to use the last password entered to lock the '%s' page? ",
	CONFIRM_LOCK_LAST: "The password was last used on the '%s' page.",
	CONFIRM_READ_ONLY: "You will have to manually edit the file to revert this change.\n\nAny other changes to options will also be saved.",
	CONFIRM_REMOVE_ENCRYPT: "Do you want to remove encryption from the '%s' page?",
	CONTINUE_WAIT_LOAD: "The loading process seems stuck.\nPlease click OK to keep waiting or Cancel to break.",
	DELETE:"Delete page:",
 	DELETE_FILE:"Delete embedded file",
 	DELETE_IMAGE:"Delete embedded image",
	DELETE_PAGE_PROMPT: "Delete page:",
	DISPLAY_FULL_FILE: "Display full file",
	DUP_NS_ERROR: "Cannot duplicate into File:: or Image:: namespace!",
	DUPLICATE_PAGE: "Insert duplicate page title",
	EDITING:"Editing '%s'",
	EMPTY_TITLE: "An empty title is not allowed.",
	EMPTY_NS: "/No pages in '%s' namespace./",
	ERR_MARKER: "'%s' marker not found!",
	ERR_NO_PWD: "No password set for decrypting the '%s' page.\nPlease click the key icon and enter a password.",
	ERR_PAGE_NS: "You cannot create a page as a namespace.",
	ERR_RESERVED_NS: "Namespace '%s' is reserved.",
	ERR_SEL_FILE: "A file must be selected.",
	ERR_VAR_MARKER: "Marker variable not found!",
 	EXPORT_FILE:"Export file",
 	EXPORT_IMAGE:"Export image",
	EXPORT_OK: "%d/%d pages exported successfully.",
	FAILED_ERASE:"Saving the erased WoaS has failed!\n\nOriginal content will be restored by reloading file.",
	FILE_DISPLAY_LIMIT: "Only the first 1024 bytes are displayed.",
	FILE_SELECT_ERR: "A file must be selected.",
	FILE_SIZE: "File size",
	GO_TO_PAGE: "Go to page:",
	HEIGHT: "Height",
	IMG_LOAD_ERR: "/Image failed to load./\n",
	IMPORT_CONFIG: "Configuration imported.",
	IMPORT_INCOMPAT: "Incompatible version: %s",
	IMPORT_OLD_VER: "If this is a WoaS older than v0.9.6B, you should import it by using WoaS 0.11.x.",
	IMPORT_OK: "%s pages imported successfully (%d pages skipped)",
	IMPORT_UNRECON: "Unrecognized format.",
	INSERT_NEW:"Insert new page title",
	INVALID_ALIAS: "Invalid '%s' alias will be ignored.",
	INVALID_DATA:"Invalid collected data!",
	INVALID_PAGE: "Invalid %s page.",
	INVALID_TITLE: "Title cannot contain ':::' or any of these characters:\n# \" | < > [ ] { }",
	JS_DISABLED: "Scripts are disabled in Special::Options ('Enable safe mode')\n",
	JS_PAGE_FAIL1: "Dynamic evaluation of '%s' failed!",
	JS_PAGE_FAIL2: "\n\nError message:\n\n",
	JS_PAGE_FAIL3: "\n\nInvalid return value or type:\n\nValue: '%s'\nType: '%s'",
	LAST_MODIFIED: "Last modified: ",
	LOADING: "Loading Wiki on a Stick...",
	LOAD_ERR: "Cannot load specified file.",
	MIME_TYPE: "Mime type",
	MODE_NOT_AVAIL: "File mode 0x%s is not available on this browser.",
	NO_ERROR: "No error",
	NO_JAVA:"It was not possible to use TiddlySaver Java applet nor direct Java saving.",
	NO_TIDDLY_SAVER:"The TiddlySaver Java applet was not available.",
	NOT_A_NS:"/'%s' is a reserved namespace that is not listable. See [[WoaS::Help::Namespaces#Reserved namespaces|Help]]./",
	NOT_YET_IMPLEMENTED: "Feature not implemented yet.",
	NOTE_TEXT: "NOTE:",
	PAGE_EXISTS: "A page with title '%s' already exists!",
	PAGE_NOT_EXISTS: "'%s' page does not exist.",
	PAGE_NOT_FOUND: "Page not found. Do you want to create it?",
	PRINT_MODE_WARN: "Sorry, you cannot browse the wiki while in print mode.",
	PWD_QUERY: "Please enter a password.",
	READ_ONLY: "This Wiki on a Stick is read-only.",
	SAVE_ERROR:"Unable to save the '%s' file.",
	SERVER_MODE: "This Wiki on a Stick is not a local file; changes can only be saved to a local copy of the wiki. Please save this file if you want to make changes.\n\n"+
					"None of the changes made to this copy of Wiki on a Stick will be saved.",
	STATIC_NOT_FOUND: "Static page '%s' not found!",
	TIDDLY_HELP:"Please check that TiddlySaver.jar is in the same directory as this WoaS and that you have enabled Java permissions for it.",
	TOC: "Table of Contents",
	TOO_LONG_TITLE: "Maximum title length is %d characters.",
	UNSPECIFIED_JAVA_ERROR: "Please check the Java console for errors regarding the last operation and check that it's not due to your browser/Java restrictions.",
	UNSUPPORTED_BROWSER: "Your browser might not be supported. Please report a bug with your UserAgent string:\n%s",
	WIDTH: "Width",
	WRITE_PROTECTED: "This Wiki on a Stick is already write-protected.",
	WSIF_BAD_HV: "Could not locate end of header value.",
	WSIF_DS_TO_EXTERNAL: "The content of this wiki is about to be saved in WSIF format to the filename you entered.\n\nAll internal content will be deleted.\n\n",
	WSIF_DS_TO_INTERNAL: "The current wiki content is about to be stored internally.\n\nThe current WSIF data source file(s) will not be affected.",
	WSIF_DS_TO_MULTI: "The WSIF data source file is about to be rewritten as a page index WSIF file.",
	WSIF_DS_TO_SINGLE: "The current WSIF index file, listing individual page WSIF files, is about to be overwritten with page content.\n\nExisting WSIF files for pages will not be affected.",
	WSIF_EXIST: "If the filename you entered already exists it is about to be overwritten!",
	WSIF_NO_HN: "Could not locate header name.",
	WSIF_NO_VER: "Could not read WSIF version.",
	WSIF_NS_VER: "WSIF version %s is not supported!",
	WSIF_PAGES: "\n\nIf individual page files already exist for this data source file they will be overwritten.",
	WSIF_SAVE_FAIL: "Unable to save WSIF file with path given!\nCheck your data source setting in Special::Options"
};

// do not use any copyrighted wordlist here
woas.i18n.common_words = ['the','of','to' ,'and' ,'a' ,'in' ,'is' ,'it' ,'you' ,'that' ,'he' ,'was' ,'for','on' ,'are' ,'with' ,'as' ,'I' ,'his' ,'they' ,'be' ,'at' ,'one' ,'have' ,'this' ,'from' ,'or' ,'had' ,'by' , 'an', 'all' ];

/*
Used to load alternative language plug-ins (e.g.: plugins/translations).
Can also be used by plugins to add strings to i18n object, or change wording.
	obj = {
		strings:{} - strings to replace/augment built-in strings
		strings_add: bool (optional) - change existing string collection
			F: string is ignored if not found in i18n (default)
			T: string will be added to i18n collection if it doesn't exist
		common_words:[] - exclusion list used by Special::Export to build webpage metadata
		common_words_replace: bool (optional) - change existing word list
			F: common_words added to existing words if not already present (default)
			T: i18n.common_words list will be overwritten by common_words array
	}
*/
woas.i18n.load = function(obj) {
	var str, i, il, keys = {};
	if (obj.strings) {
		for (str in obj.strings) {
			if ((obj.strings_add || this.hasOwnProperty(str)) &&
					obj.strings.hasOwnProperty(str) &&
					(typeof obj.strings[str]) === 'string') {
				this[str] = obj.strings[str];
				keys[str] = true;
			}
		}
		// report strings missing from translation
		for (str in this) {
			if (!keys[str] && (typeof this[str]) === 'string') {
				woas.log('Missing - '+this.list_item(str));
			}
		}
	}
	if (obj.common_words && (obj.common_words instanceof Array)
			&& obj.common_words.length) {
		if (obj.common_words_replace) {
			this.common_words = [];
		}
		this.common_words = this.common_words.concat(obj.common_words)
			.toUnique();
	}
}

woas.i18n.list = function() {
	var str, list = [];
	for (str in this) {
		if ((typeof this[str]) === 'string') {
			list.push(this.list_item(str));
		}
	}
	return list.join('\n');
}

woas.i18n.list_item = function(key){
	return key+': "'+this[key].replace(/\n\\?/g, '\\n')
		.replace(/\t/g, '\\t')+'"';
}
