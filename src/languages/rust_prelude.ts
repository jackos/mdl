// Add a macro to send dbg to stdout so the output doesn't get out of sync with stderr, also stops
// the line numbers and file name being printed which we don't want
export const prelude = `#![allow(unused_macros)]\n
#![allow(dead_code)]\n
macro_rules! dbg {
    ($val:expr $(,)?) => {
        match $val {
            tmp => {
                ::std::println!("{:?}", &tmp);
                tmp
            }
        }
    };
    ($($val:expr),+ $(,)?) => {
        ($(dbg!($val)),+,)
    };
}

macro_rules! dbg_named {
    ($val:expr $(,)?) => {
        match $val {
            tmp => {
                ::std::println!("{} = {:?}", ::std::stringify!($val), &tmp);
				tmp
            }
        }
    };
    ($($val:expr),+ $(,)?) => {
        ($(dbg_named!($val)),+,)
    };
}

macro_rules! dbg_pretty {
    ($val:expr $(,)?) => {
        match $val {
            tmp => {
                ::std::println!("{:#?}", &tmp);
				tmp
            }
        }
    };
    ($($val:expr),+ $(,)?) => {
        ($(dbg_pretty!($val)),+,)
    };
}
`
