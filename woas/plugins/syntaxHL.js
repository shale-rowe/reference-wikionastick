/* shjs binding for WoaS
   @author legolas558
   @version 0.1.0
   @license GPLv2

   works with shjs 0.6
   be sure that you have downloaded and extracted shjs in shjs directory
*/

woas.custom.shjs = {
	
	// we take an unique id for our job
	_uid: _random_string(8),
	
	init: function() {
		
	},
	
	_macro_hook: function(macro) {
		
	}
	
};


// initialize the library
woas.custom.shjs.init();

// register the macro
woas.macro_parser.register('woas.shjs', woas.custom.shjs._macro_hook);
