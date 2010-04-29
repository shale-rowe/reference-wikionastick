/* jsMath binding for WoaS
   @author legolas558
   @version 0.1.5
   @license GPLv2

   works with jsMath 3.6e
   be sure that you have downloaded and extracted jsMath in jsMath directory
*/

woas.custom.jsMath = {
	is_loaded: false,
	postrender: 0,		// number of divs to render after library finishes loading
	init : function() {
		if (!this.is_loaded)
        // setup jsMath config object and
        // load libraries after defining global jsMath
		this.is_loaded = woas.dom.add_script("lib", "jsMath0", "\
         jsMath = {\
            Controls: {\
              cookie: {scale: 133, global: 'never', button:0}\
            },\
            Font: {\
		Message : function(msg) {woas.log(woas.xhtml_to_text(msg).replace(/\\n\\n/g, \"\\n\"));}\
	    },\
            UserEvent: { onload: woas.custom.jsMath.post_render },\
         noGoGlobal:1,\
         noChangeGlobal:1,\
         noShowGlobal:1\
         };", false) &&
			 woas.dom.add_script("lib", "jsMath1", "plugins/jsMath/plugins/noImageFonts.js", true) &&
			 woas.dom.add_script("lib", "jsMath2", "plugins/jsMath/jsMath.js", true);
	     return this.is_loaded;
	},
	// used for post-rendering after library was loaded
	post_render: function() {
		return;
     jsMath.Init();
     var elem;
     for(var i=0;i<this.postrender;++i) {
//         elem = $("jsmath_postrender_"+i);
//         elem.innerHTML = jsMath.Translate.Parse('T', elem.innerHTML);
         jsMath.Process("jsmath_postrender_"+i)
     }
     this.postrender = 0;
	},
	
	_macro_hook : function(macro) {
		 // quit if libraries have not yet been loaded and
		 // increase counter for post-rendering
		 if (typeof jsMath.Process == "undefined") {
/*			macro.text = "<"+"div id=\"jsmath_postrender_\""+this.postrender+">"+macro.text+"<"+"/div>"+
						"<"+"input id=\"jsmath_postr_btn_"+this.postrender+
						"\" type=\"button\" value=\"Render\" onclick=\"jsMath.Process('jsmath_postrender_"+
						this.postrender+
						"');$.hide('jsmath_postr_btn_"+this.postrender+"');\" /"+">";
			++this.postrender; */
			return;
		 }
		 jsMath.Init();
		 macro.text = jsMath.Translate.Parse('T', macro.text);
	}
	
};

// initialize the library
woas.custom.jsMath.init();

// register the macro
woas.macro_parser.register('jsmath', woas.custom.jsMath._macro_hook);
