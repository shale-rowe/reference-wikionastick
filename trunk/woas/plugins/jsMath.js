/* jsMath binding for WoaS
   @author legolas558

   works with jsMath 3.6e
   be sure that you have downloaded and extracted jsMath in jsMath directory
*/

var _g_jsmath_loaded = false;

if (!_g_jsmath_loaded) {
        _g_jsmath_loaded = true;
        // setup jsMath config object and
        // load libraries after defining global jsMath
        //NOTE: this is a bit unsupported right now
	var s1 = woas._mk_active_script("\
         jsMath = {\
            Controls: {\
              cookie: {scale: 133, global: 'never', button:0}\
            },\
            Font: {\
		Message : function(msg) {log(woas.xhtml_to_text(msg).replace(/\\n\\n/g, \"\\n\"));}\
	    },\
            UserEvent: { onload: function() { setTimeout('_woas_jsmath_postrender()', 1000); },\
         noGoGlobal:1,\
         noChangeGlobal:1,\
         noShowGlobal:1\
         };", "lib", 0, false),
	    s2 = woas._mk_active_script("plugins/jsMath/plugins/noImageFonts.js", "lib", 1, true),
            s3 = woas._mk_active_script("plugins/jsMath/jsMath.js", "lib", 2, true);
}

var jsmath_postrender = [];

// used for post-rendering after library was loaded
function _woas_jsmath_postrender() {
     jsMath.Init();
     var elem;
     for(var i=0,it=jsmath_postrender.length;i<it;++i) {
//         elem = $("jsmath_postrender_"+i);
         jsMath.Process("jsmath_postrender_"+i)
//         elem.innerHTML = jsMath.Translate.Parse('T', elem.innerHTML);
     }
     jsmath_postrender = [];
}

function _jsmath_macro(macro) {
     // quit if libraries have not yet been loaded
     if (typeof jsMath.Process == "undefined") {
        macro.text = "<"+"div id=\"jsmath_postrender_\""+jsmath_postrender.length+">"+macro.text+"<"+"/div>";
        return;
     }
     jsMath.Init();
     macro.text = jsMath.Translate.Parse('T', macro.text);
}

// register this new macro
woas.macro_parser.register('jsmath', _jsmath_macro);
