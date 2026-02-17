class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def greet(self):
        print(f"Hello, my name is {self.name} and I am {self.age} years old.")


x = 0

for i in range(10):
    print(i)

if x == 0:
    print("x is 0")
else:
    print("x is not 0")

print("Hello World")

def add(a, b):
    return a + b


print(add(1, 2))

person = Person("John", 30)

person.greet()
print("Done!")
