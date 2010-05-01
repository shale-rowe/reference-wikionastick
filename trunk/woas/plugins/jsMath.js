/* jsMath binding for WoaS
   @author legolas558
   @version 0.1.7
   @license GPLv2

   works with jsMath 3.6e
   be sure that you have downloaded and extracted jsMath in jsMath directory
*/

// this is necessary before loading any jsMath library
jsMath = {
	Controls: {
		cookie: {scale: 133, global: 'never', button:0}
	},
	Font: {
		// override font messages
		Message : function(msg) {woas.log(woas.xhtml_to_text(msg).replace(/\n\n/g, "\n"));}
	},
	noGoGlobal:1,
	noChangeGlobal:1,
	noShowGlobal:1
};

woas.custom.jsMath = {
	is_loaded: false,
	init : function() {
		if (!this.is_loaded)
        // setup jsMath config object and
        // load libraries after defining global jsMath
		this.is_loaded =  woas.dom.add_script("lib", "jsMath0", "plugins/jsMath/plugins/noImageFonts.js", true,
								woas.custom.jsMath.render_all) &&
						woas.dom.add_script("lib", "jsMath1", "plugins/jsMath/jsMath.js", true,
								woas.custom.jsMath.render_all);
		return this.is_loaded;
	},
	
	_block: 0,		// number of pre tags to render after library finishes loading
	_called: 0,
	_rendering: false,
	render_all: function() {
		if (woas.custom.jsMath._rendering) return;
		if (++woas.custom.jsMath._called == 2) {
			woas.custom.jsMath._rendering = true;
			jsMath.Init();
			for(var i=0;i < woas.custom.jsMath._block;++i) {
				woas.custom.jsMath.post_render(i);
			}
			woas.custom.jsMath._block = 0;
		}
	},
	
	// used for post-rendering after library was loaded
	post_render: function(i) {
//		jsMath.Init();
		var elem = $("jsmath_postrender_"+i);
		woas.setHTML(elem, jsMath.Translate.Parse('T', woas.getHTML(elem)));
		$.hide("jsmath_postr_btn_"+i);
		return;
	},
*/
	
	_macro_hook : function(macro) {
		 // quit if libraries have not yet been loaded and
		 // increase counter for post-rendering
/*		 if (typeof jsMath.Process == "undefined") {
			macro.text = "<"+"div id=\"jsmath_postrender_"+woas.custom.jsMath._block+"\">"+macro.text+"<"+"/div>"+
						"<"+"input id=\"jsmath_postr_btn_"+woas.custom.jsMath._block+
						"\" type=\"button\" value=\"Render\" onclick=\"woas.custom.jsMath.post_render("+woas.custom.jsMath._block+");\" /"+">";
			++this._block;
			return;
		 } */
// 		this._block = 0;
		jsMath.Init();
		macro.text = jsMath.Translate.Parse('T', macro.text);
	}
	
};

// initialize the library
woas.custom.jsMath.init();

// register the macro
woas.macro_parser.register('woas.jsmath', woas.custom.jsMath._macro_hook);
