/* shjs binding for WoaS
   @author legolas558
   @version 0.1.5
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
	_highlight_element: function(element, htmlClasses) {
		for (var j = 0; j < htmlClasses.length; j++) {
			var htmlClass = htmlClasses[j].toLowerCase();
			if (htmlClass === 'sh_sourcecode') {
				continue;
			}
			if (htmlClass.substr(0, 3) === 'sh_') {
				var language = htmlClass.substring(3);
				if (language in sh_languages) {
					sh_highlightElement(element, sh_languages[language]);
/*				} else if (typeof(prefix) === 'string' && typeof(suffix) === 'string') {
					sh_load(language, element, prefix, suffix); */
				} else {
					woas.log('Element has class="' + htmlClass + '", but no such language exists');
				}
				break;
			}
		} // for htmlClasses
	},
	
	_macro_hook: function(macro, classes) {
		// rebuild the classes string as a simple JSON array
		var classes = classes.split(' '), classes_v="[", cl = classes.length;
		if (cl) {
			for (var i = 0; i < cl-1; i++) {
				if (classes[i].length > 0) {
					classes_v += "'"+woas.js_encode(woas.trim(classes[i]))+"',";
				}
			}
			// add the last one
			classes_v += "'"+woas.js_encode(woas.trim(classes[cl-1]))+"'";
		}
		classes_v += "]";

		macro.text = "<"+"div id=\"woas_shjs_"+this._uid+"\">"+macro.text+"<"+"/div>"+
					"<"+"script type=\"text/javascript\">"+
					"_highlight_element($('woas_shjs_"+this._uid+"',"+classes_v+");"+
					"<"+"/script>";
		macro.reprocess = true;
	}
	
};

// initialize the library
woas.custom.shjs.init();

// register the macro
woas.macro_parser.register('woas.shjs', woas.custom.shjs._macro_hook);
