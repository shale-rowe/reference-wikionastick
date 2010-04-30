/* shjs binding for WoaS
   @author legolas558
   @version 0.1.7
   @license GPLv2

   works with shjs 0.6
   be sure that you have downloaded and extracted shjs in shjs directory
*/

woas.custom.shjs = {
	
	// we take an unique id for our job
	is_loaded: false,
	_uid: _random_string(8),
	
	init: function() {
		if (!this.is_loaded)
			this.is_loaded = woas.dom.add_script("lib", "shjs", "plugins/shjs/sh_main.js", true);
		return this.is_loaded;
	},
	
	// this was adapted from shjs' sh_highlightDocument
	_highlight_element: function(element, languages) {
		for (var j = 0; j < languages.length; j++) {
			if (languages[j] in sh_languages) {
				sh_highlightElement(element, sh_languages[languages[j]]);
			} else { // attempt to load such language
				woas.log("Cannot render in for language "+languages[j]);
			}
			break;
		}
	},
	
	_macro_hook: function(macro, classes) {
		// rebuild the classes string as a simple JSON array
		var classes_arr = classes.split(' '), classes_v="[", cl = classes_arr.length;
		if (cl) {
			var language;
			for (var i = 0; i < cl; i++) {
				if (classes_arr[i].length > 0) {
					language = woas.trim(classes_arr[i]).toLowerCase();
					if (language.substr(0,3) !== "sh_")
						continue;
					language = language.substr(3);
					// skip this one
					if (language === "sourcecode")
						continue;
					classes_v += "'"+woas.js_encode(language)+"',";
					if (!(language in sh_languages)) {
						// load this library
						woas.dom.add_script("lib", "shjs_"+language, "plugins/shjs/sh_"+language+".js", true);
					}
				}
			}
			// remove final comma
			classes_v = classes_v.substr(0, classes_v.length-1);
		}
		classes_v += "]";

		macro.text = "<"+"div id=\"woas_shjs_"+this._uid+"\" class=\""+classes+"\">"+macro.text+"<"+"/div>"+
					"<"+"script type=\"text/javascript\">"+
					"woas.custom.shjs._highlight_element($('woas_shjs_"+this._uid+"'),"+classes_v+");"+
					"<"+"/script>";
		macro.reprocess = true;
	}
	
};

// initialize the library
woas.custom.shjs.init();

// register the macro
woas.macro_parser.register('woas.shjs', woas.custom.shjs._macro_hook);
