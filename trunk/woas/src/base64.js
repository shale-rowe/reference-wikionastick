woas.base64 = {
	_b64arr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
	reValid: /^[A-Za-z0-9+\/=]+$/,
	
	_core_encode: function(c1, c2, c3) {
		var enc1, enc2, enc3, enc4;
		
		enc1 = c1 >> 2;
		enc2 = ((c1 & 3) << 4) | (c2 >> 4);
		enc3 = ((c2 & 15) << 2) | (c3 >> 6);
		enc4 = c3 & 63;

		if (isNaN(c2))	enc3 = enc4 = 64;
		else if (isNaN(c3))
			enc4 = 64;

		return this._b64arr.charAt(enc1) + this._b64arr.charAt(enc2) +
				this._b64arr.charAt(enc3) +	this._b64arr.charAt(enc4);
	},

	encode_array: function(input_arr) {
		var c1, c2, c3, i = 0, z = input_arr.length,output = "";
		
		do {
			c1 = input_arr[i++];
			if (i == z)
				c3 = c2 = null;
			else {
				c2 = input_arr[i++];
				if (i == z)
					c3 = null;
				else
					c3 = input_arr[i++];
			}
			output += this._core_encode(c1, c2, c3);
		} while (i < z);
		return output;
	},

	encode: function(input) {
		var c1, c2, c3, i = 0, z = input.length, output = "";
		
		do {
			c1 = input.charCodeAt(i++);
			c2 = input.charCodeAt(i++);
			c3 = input.charCodeAt(i++);
			
			output += this._core_encode(c1, c2, c3);
		} while (i < z);
		return output;
	},

	decode: function(input, z) {
		var c1, c2, c3, enc1, enc2, enc3, enc4, i = 0,
			output = "";
		
		var l=input.length;
		if (typeof z=='undefined') z = l;
		else if (z>l) z=l;

		do {
			enc1 = this._b64arr.indexOf(input.charAt(i++));
			enc2 = this._b64arr.indexOf(input.charAt(i++));
			enc3 = this._b64arr.indexOf(input.charAt(i++));
			enc4 = this._b64arr.indexOf(input.charAt(i++));

			c1 = (enc1 << 2) | (enc2 >> 4);
			c2 = ((enc2 & 15) << 4) | (enc3 >> 2);
			c3 = ((enc3 & 3) << 6) | enc4;

			output += String.fromCharCode(c1);
			if (enc3 != 64)
				output += String.fromCharCode(c2);
			if (enc4 != 64)
				output += String.fromCharCode(c3);

		} while (i < z);

		return output;
	},

	decode_array: function(input, z) {
		var c1, c2, c3, enc1, enc2, enc3, enc4, i = 0;
		var output = [];
		
		var l=input.length;
		if (typeof z=='undefined') z = l;
		else if (z>l) z=l;

		do {
			enc1 = this._b64arr.indexOf(input.charAt(i++));
			enc2 = this._b64arr.indexOf(input.charAt(i++));
			enc3 = this._b64arr.indexOf(input.charAt(i++));
			enc4 = this._b64arr.indexOf(input.charAt(i++));

			c1 = (enc1 << 2) | (enc2 >> 4);
			c2 = ((enc2 & 15) << 4) | (enc3 >> 2);
			c3 = ((enc3 & 3) << 6) | enc4;

			output.push(c1);
			if (enc3 != 64)
				output.push(c2);
			if (enc4 != 64)
				output.push(c3);
		} while (i < z);
		return output;
	}

};
