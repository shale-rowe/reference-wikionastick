/* jsMath binding for WoaS
   @author legolas558

   works with jsMath 3.6e
   be sure that you have downloaded and extracted jsMath in jsMath directory
*/

var _g_jsmath_loaded = false, jsMath_container;

if (!_g_jsmath_loaded) {
        _g_jsmath_loaded = true;
        // setup jsMath config object and
        // load libraries after defining global jsMath
        //NOTE: this is a bit unsupported right now
	var s1 = woas._mk_active_script("\
         jsMath = {\
            Controls: {\
              cookie: {scale: 133, global: 'never'}\
            },\
            Font: {\
		Message : function(msg) {alert(woas.xhtml_to_text(msg));}\
	    },\
         noGoGlobal:1,\
         noChangeGlobal:1,\
         noShowGlobal:1\
         };", "lib", 0, false),
	    s2 = woas._mk_active_script("plugins/jsMath/plugins/noImageFonts.js", "lib", 1, true),
            s3 = woas._mk_active_script("plugins/jsMath/jsMath.js", "lib", 2, true);
         // now create the element which will hold our creation
         jsMath_container = document.createElement("div");
         jsMath_container.id = "jsMath_container";
         jsMath_container.style.visibility = "hidden";
         jsMath_container.style.display = "none";
         jsMath_container.innerHTML = "&nbsp;";
         document.body.appendChild(jsMath_container);
}

//alert(jsMath.Process);
//alert(jsMath.Process);

function _jsmath_macro(macro) {
     // quit if libraries have not yet been loaded
     if (typeof jsMath.Process == "undefined")
        return;
     // copy macro argument to container
     jsMath_container.innerHTML = woas.trim(macro.text);
     // now proceed to latex parsing
     jsMath.Process(jsMath_container);
     // copy back processed stuff
     macro.text = jsMath_container.innerHTML;
//     macro.reprocess = false;
}

// register this new macro
woas.macro_parser.register('jsmath', _jsmath_macro);

