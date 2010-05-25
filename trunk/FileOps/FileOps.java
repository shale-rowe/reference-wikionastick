// FileOps applet is based on TiddlySaver applet
// adapted for WoaS by @author legolas558
// original @author J.Rouston
// @license GNU/GPLv2
// to see original license (BSD), read license.txt

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.FileWriter;
import java.security.AccessController;
import java.security.PrivilegedAction;

public class FileOps extends java.applet.Applet {
  public String loadFile(final String filename, final String charset) {
	return (String)AccessController.doPrivileged(new PrivilegedAction() {
	    public Object run() {		
		  try {
		    if (charset.length() == 0) {
		      StringBuffer data = new StringBuffer();
		      BufferedReader r = new BufferedReader(new FileReader(filename));
		      String line;
		      while ((line = r.readLine()) != null) data.append(line).append("\n");
		      r.close();
		      return data.toString();
		    } else {
		      File f = new File(filename);
		      FileInputStream i = new FileInputStream(f);
		      byte[] b = new byte[(f.length() > Integer.MAX_VALUE) ? Integer.MAX_VALUE : (int)f.length()];
		      int offset = 0;
		      int num = 0;
		      while (offset < b.length && (num = i.read(b, offset, b.length - offset)) >= 0) {
		        offset += num;
		      }
		      i.close();
		      return new String(b, 0, offset, charset);
		    }
		  } catch (Exception x) {
		    x.printStackTrace();
		    return null;
		  }
        }
	  });
  }
  public int saveFile(final String filename, final String charset, final String data) {
    return ((Integer)AccessController.doPrivileged(new PrivilegedAction() {
      public Object run() {		
    	try {
          if (charset.length() == 0) {
            int e, s = 0;
            BufferedWriter w = new BufferedWriter(new FileWriter(filename));
            do {
              e = data.indexOf('\n', s);
              if (e == -1) e = data.length();
              w.write(data, s, e - s);
              w.newLine();
              s = e + 1;
            } while (s < data.length());
            w.close();
            return new Integer(1);
          } else {
            FileOutputStream o = new FileOutputStream(filename);
            o.write(data.getBytes(charset));
            o.close();
            return new Integer(1);
          }
        } catch (Exception x) {
          x.printStackTrace();
          return new Integer(0);
        }
      }
    })).intValue();
  }

  public int saveFileBinary(final String filename, final String data) {
    return ((Integer)AccessController.doPrivileged(new PrivilegedAction() {
      public Object run() {		
    	try {
			DataOutputStream os = new DataOutputStream(new FileOutputStream(filename));
			os.writeBytes(data);
			os.close();
			return new Integer(1);
        } catch (Exception x) {
          x.printStackTrace();
          return new Integer(0);
        }
      }
    })).intValue();
  }

  public String loadFileBinary(final String filename) {
	return (String)AccessController.doPrivileged(new PrivilegedAction() {
	    public Object run() {		
		  try {
		      File f = new File(filename);
		      FileInputStream i = new FileInputStream(f);
		      // is the length check necessary?
		      byte[] b = new byte[(f.length() > Integer.MAX_VALUE) ? Integer.MAX_VALUE : (int)f.length()];
		      DataInputStream di = new DataInputStream(i);
		      di.readFully(b);
		      i.close();
		      return new String(b);
		  } catch (Exception x) {
		    x.printStackTrace();
		    return null;
		  }
        }
	  });
  }

} // end of FileOps class
