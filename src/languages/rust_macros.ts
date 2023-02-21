// Add a macro to send dbg to stdout so the output doesn't get out of sync with stderr, also stops
// the line numbers and file name being printed which we don't want
export const prelude = `#[macro_export]
macro_rules! dbg_mdl {
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

#[macro_export]
macro_rules! dbg {
    ($val:expr $(,)?) => {
        match $val {
            tmp => {
                ::std::println!("{} = {:#?}", ::std::stringify!($val), &tmp);
				tmp
            }
        }
    };
    ($($val:expr),+ $(,)?) => {
        ($(dbg_named!($val)),+,)
    };
}

#[macro_export]
macro_rules! dbg_mdl_pretty {
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
`;
