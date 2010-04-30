/* shjs binding for WoaS
   @author legolas558
   @version 0.1.9
   @license GPLv2

   works with shjs 0.6
   be sure that you have downloaded and extracted shjs in shjs directory
*/

woas.custom.shjs = {
	
	// we take an unique id for our job
	is_loaded: false,
	_uid: _random_string(8),
	_block: 0,			// current block
	
	init: function() {
		if (!this.is_loaded)
			this.is_loaded = woas.dom.add_script("lib", "shjs", "plugins/shjs/sh_main.min.js", true) &&
							woas.dom.add_css("shjs_style", "plugins/shjs/sh_style.min.css", true);
		return this.is_loaded;
	},
	
	// this was adapted from shjs' sh_highlightDocument
	_highlight_element: function(element, languages) {
		for (var j = 0; j < languages.length; j++) {
			if (languages[j] in sh_languages) {
				sh_highlightElement(element, sh_languages[languages[j]]);
			} else {
				woas.log("Cannot render language "+languages[j]);
			}
			break;
		}
	},

	// used for post-rendering after library was loaded
	post_render: function(i, languages) {
		$.hide("shjs_postr_btn_"+this._uid+"_"+i);
		var elem = $("woas_shjs_"+this._uid+"_"+i);
		this._highlight_element(elem, languages);
		return;
	},
	
	_macro_hook: function(macro, classes) {
		// shjs library not yet loaded, go into pre-render mode
		var pre_render = (typeof sh_languages == "undefined");

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
					if (pre_render || !(language in sh_languages)) {
						// load this library
						woas.dom.add_script("lib", "shjs_"+language, "plugins/shjs/lang/sh_"+language+".min.js", true);
					}
				}
			}
			// remove final comma
			classes_v = classes_v.substr(0, classes_v.length-1);
		}
		classes_v += "]";

		macro.text = "<"+"pre id=\"woas_shjs_"+woas.custom.shjs._uid+"_"+woas.custom.shjs._block+"\" class=\""+classes+"\">"+macro.text+"<"+"/pre>";
		if (pre_render) {
			macro.text += "<"+"input id=\"shjs_postr_btn_"+woas.custom.shjs._uid+
						"_"+woas.custom.shjs._block+"\" type=\"button\" value=\"Render\" onclick=\"woas.custom.shjs.post_render("+woas.custom.shjs._block+","+classes_v+");\" /"+">";
		} else { // inline script for highlighting
					"<"+"script type=\"text/javascript\">"+
					"woas.custom.shjs._highlight_element($('woas_shjs_"+woas.custom.shjs._uid+"_"+woas.custom.shjs._block+"'),"+classes_v+");"+
					"<"+"/script>";
		}
		macro.reprocess = true;
		++woas.custom.shjs._block;
	}
	
};

// initialize the library
woas.custom.shjs.init();

// register the macro
woas.macro_parser.register('woas.shjs', woas.custom.shjs._macro_hook);
