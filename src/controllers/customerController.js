const Customer = require('../models/Customer');
const Loan = require('../models/Loan'); // Needed for checking if customer has loans before delete

// @desc    Get all customers for the logged-in shopkeeper
// @route   GET /api/customers
// @access  Private
const getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({ shopkeeper: req.user.id }).sort({ name: 1 }); // Sort by name
    res.json(customers);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Get a single customer by ID
// @route   GET /api/customers/:id
// @access  Private
const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Ensure the customer belongs to the logged-in shopkeeper
    if (customer.shopkeeper.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to view this customer' });
    }

    res.json(customer);
  } catch (err) {
    console.error(err.message);
     if (err.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Customer not found (Invalid ID format)' });
     }
    res.status(500).send('Server Error');
  }
};

// @desc    Add a new customer
// @route   POST /api/customers
// @access  Private
const addCustomer = async (req, res) => {
  const { name, phone, address, trustScore, creditLimit } = req.body;

  // Basic validation
  if (!name || !phone) {
      return res.status(400).json({ message: 'Name and Phone are required' });
  }

  try {
    // Optional: Check if customer with the same phone already exists for this shopkeeper
    // const existingCustomer = await Customer.findOne({ phone: phone, shopkeeper: req.user.id });
    // if (existingCustomer) {
    //   return res.status(400).json({ message: 'Customer with this phone number already exists for you.' });
    // }


    const newCustomer = new Customer({
      name,
      phone,
      address: address || '',
      trustScore: trustScore !== undefined ? Number(trustScore) : 5,
      creditLimit: creditLimit !== undefined ? Number(creditLimit) : 0,
      shopkeeper: req.user.id, // Associate with the logged-in shopkeeper
    });

    const customer = await newCustomer.save();
    res.status(201).json(customer);
  } catch (err) {
    console.error('Add Customer Error:', err);
     if (err.name === 'ValidationError') {
         const messages = Object.values(err.errors).map(val => val.message);
         return res.status(400).json({ message: messages.join('. ') });
     }
    res.status(500).send('Server Error');
  }
};

// @desc    Update a customer
// @route   PUT /api/customers/:id
// @access  Private
const updateCustomer = async (req, res) => {
  const { name, phone, address, trustScore, creditLimit } = req.body;

  // Build customer object based on fields present in the request body
  const customerFields = {};
  if (name) customerFields.name = name;
  if (phone) customerFields.phone = phone;
  if (address !== undefined) customerFields.address = address; // Allow empty string
  if (trustScore !== undefined) customerFields.trustScore = Number(trustScore);
  if (creditLimit !== undefined) customerFields.creditLimit = Number(creditLimit);
  customerFields.updatedAt = Date.now(); // Manually set updatedAt

  try {
    let customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Ensure the customer belongs to the logged-in shopkeeper
    if (customer.shopkeeper.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to update this customer' });
    }

    // Optional: Add validation for updated phone uniqueness if needed here

    customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: customerFields },
      { new: true, runValidators: true } // Return the updated document and run schema validators
    );

    res.json(customer);
  } catch (err) {
    console.error('Update Customer Error:', err);
     if (err.name === 'ValidationError') {
         const messages = Object.values(err.errors).map(val => val.message);
         return res.status(400).json({ message: messages.join('. ') });
     }
     if (err.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Customer not found (Invalid ID format)' });
     }
    res.status(500).send('Server Error');
  }
};

// @desc    Delete a customer
// @route   DELETE /api/customers/:id
// @access  Private
const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Ensure the customer belongs to the logged-in shopkeeper
    if (customer.shopkeeper.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to delete this customer' });
    }

    // **Important Check:** Prevent deletion if the customer has associated loans
    const loans = await Loan.find({ customer: req.params.id, shopkeeper: req.user.id });
    if (loans.length > 0) {
      return res.status(400).json({ message: 'Cannot delete customer with active or past loans. Consider archiving instead.' });
      // Note: You might want to allow deletion only if all loans are fully paid,
      // or implement a "soft delete" / archiving mechanism instead of hard deletion.
    }

    await Customer.findByIdAndDelete(req.params.id);

    res.json({ message: 'Customer removed' });
  } catch (err) {
    console.error('Delete Customer Error:', err);
     if (err.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Customer not found (Invalid ID format)' });
     }
    res.status(500).send('Server Error');
  }
};


module.exports = {
  getCustomers,
  getCustomerById,
  addCustomer,
  updateCustomer,
  deleteCustomer,
};
