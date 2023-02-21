```chatgpt
Write a Python function that sums the numbers of an array passed in
```

Sure! Here's a Python function that sums the numbers of an array (list):
```python
def sum_array(arr):
    """Return the sum of numbers in the array"""
    sum = 0
    
    for n in arr:
        sum += n
    
    return sum
```

Here's an example of how you can use the function:
```python
arr = [1, 2, 3, 4, 5]
total = sum_array(arr)
print(total) # Output: 15
```
```output
15
```

This function takes an array (list) as input, and adds up each element in the array to calculate the total sum. The sum is returned as output.
