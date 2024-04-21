# Rust Prime Numbers

Here is a simple Rust function that prints prime numbers up to 27 using a helper function to check if a number is prime:

```rust
fn is_prime(n: u32) -> bool {
    if n <= 1 {
        return false;
    }
    for i in 2..=(n as f64).sqrt() as u32 {
        if n % i == 0 {
            return false;
        }
    }
    true
}

let mut vec = vec![];
for i in 2..28 {
    if is_prime(i) {
        vec.push(i);
    }
}
vec
```

```text
[2, 3, 5, 7, 11, 13, 17, 19, 23]
```

This program uses the `is_prime` function to check if each number is prime, and prints it if it is. The `is_prime` function checks for divisibility up to the square root of the number, which is an optimization for primality testing.You can run this code in a Rust compiler or IDE to see the output.
