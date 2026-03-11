"""Example Python file for testing VisualPy"""

import os
import sys
from pathlib import Path

# Configuration

DEBUG = True
MAX_ITEMS = 100


def greet(name: str, greeting: str="Hello") -> str:
    """Generate a greeting message."""

    return f"{greeting}, {name}!"


def calculate_sum(numbers: list[int]) -> int:
    """Calculate the sum of a list of numbers."""

    total = 0

    for num in numbers:
        total += num

    return total


class Calculator:
    """A simple calculator class."""

    def __init__(self, initial_value: int=0):
        self.value = initial_value

    def add(self, x: int) -> None:
        self.value += x

    def subtract(self, x: int) -> None:
        self.value -= x

    def reset(self) -> None:
        self.value = 0


def main():
    print(greet("World"))

    numbers = [1, 2, 3, 4, 5]
    result = calculate_sum(numbers)

    print(f"Sum: {result}")

    calc = Calculator(10)

    calc.add(5)
    calc.subtract(3)
    print(f"Calculator value: {calc.value}")

    if DEBUG:
        print("Debug mode is enabled")
    elif len(sys.argv) > 1:
        print(f"Args: {sys.argv[1:]}")
    else:
        print("Running in normal mode")

    for i in range(MAX_ITEMS):
        if i == 10:
            break

        if i % 2 == 0:
            continue

        print(f"Odd number: {i}")

    try:
        x = int(input("Enter a number: "))

        print(f"You entered: {x}")
    except ValueError as e:
        pass
    finally:
        pass

    print(f"Invalid input: {e}")


print("Done!")

if __name__ == "__main__":
    main()
